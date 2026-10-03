export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    try {

      // ============================================================
      // PROGRESO EN LA NUBE
      // Monedas, récord, naves/diseños, extras, equipamiento
      // y recompensa diaria
      // ============================================================

      // CARGAR PROGRESO
      if (
        request.method === "GET" &&
        url.pathname === "/api/progress"
      ) {
        const playerId =
          (url.searchParams.get("player_id") || "").trim();

        if (!playerId || playerId.length > 200) {
          return json({
            success: false,
            error: "player_id requerido"
          }, 400);
        }

        const progress = await env.DB.prepare(`
          SELECT
            player_id,
            coins,
            high_score,
            owned_ships,
            equipped_ship,
            owned_extras,
            equipped_extra,
            login_streak,
            last_login_date,
            updated_at
          FROM player_progress
          WHERE player_id = ?
          LIMIT 1
        `).bind(playerId).first();

        // Los premios ITEM ganados en torneos son posesiones
        // permanentes, incluso si el premio ya fue reclamado.
        const rewardItemsResult = await env.DB.prepare(`
          SELECT DISTINCT reward_value
          FROM player_rewards
          WHERE player_id = ?
            AND reward_type = 'ITEM'
        `).bind(playerId).all();

        const rewardItems = (rewardItemsResult.results || [])
          .map(row => String(row.reward_value || "").trim())
          .filter(Boolean);

        let ownedShips = [];
        let ownedExtras = [];

        if (progress?.owned_ships) {
          try {
            const parsed = JSON.parse(progress.owned_ships);
            if (Array.isArray(parsed)) {
              ownedShips = parsed;
            }
          } catch (_) {}
        }

        if (progress?.owned_extras) {
          try {
            const parsed = JSON.parse(progress.owned_extras);
            if (Array.isArray(parsed)) {
              ownedExtras = parsed;
            }
          } catch (_) {}
        }

        // Recuperar automáticamente diseños especiales ganados.
        for (const item of rewardItems) {
          if (!ownedShips.includes(item)) {
            ownedShips.push(item);
          }
        }

        return json({
          success: true,
          exists: !!progress,
          progress: {
            player_id: playerId,
            coins: Number(progress?.coins || 0),
            high_score: Number(progress?.high_score || 0),
            owned_ships: ownedShips,
            equipped_ship: progress?.equipped_ship || null,
            owned_extras: ownedExtras,
            equipped_extra: progress?.equipped_extra || null,
            login_streak: Number(progress?.login_streak || 0),
            last_login_date: progress?.last_login_date || null,
            updated_at: progress?.updated_at || null
          }
        });
      }


      // ============================================================
      // GUARDAR / ACTUALIZAR PROGRESO
      // ============================================================

      if (
        request.method === "POST" &&
        url.pathname === "/api/progress"
      ) {
        const body = await request.json();

        const playerId =
          typeof body.player_id === "string"
            ? body.player_id.trim()
            : "";

        if (!playerId || playerId.length > 200) {
          return json({
            success: false,
            error: "player_id inválido"
          }, 400);
        }

        const coins = Math.max(
          0,
          Math.floor(Number(body.coins) || 0)
        );

        const highScore = Math.max(
          0,
          Math.floor(Number(body.high_score) || 0)
        );

        const loginStreak = Math.max(
          0,
          Math.floor(Number(body.login_streak) || 0)
        );

        const lastLoginDate =
          body.last_login_date === null ||
          body.last_login_date === undefined ||
          body.last_login_date === ""
            ? null
            : String(body.last_login_date);

        const incomingShips = Array.isArray(body.owned_ships)
          ? body.owned_ships
              .map(value => String(value).trim())
              .filter(Boolean)
          : [];

        const incomingExtras = Array.isArray(body.owned_extras)
          ? body.owned_extras
              .map(value => String(value).trim())
              .filter(Boolean)
          : [];

        const equippedShip =
          typeof body.equipped_ship === "string" &&
          body.equipped_ship.trim()
            ? body.equipped_ship.trim()
            : null;

        const equippedExtra =
          typeof body.equipped_extra === "string" &&
          body.equipped_extra.trim()
            ? body.equipped_extra.trim()
            : null;


        // Leer progreso anterior para NO perder posesiones.
        const previous = await env.DB.prepare(`
          SELECT
            owned_ships,
            owned_extras
          FROM player_progress
          WHERE player_id = ?
          LIMIT 1
        `).bind(playerId).first();

        let previousShips = [];
        let previousExtras = [];

        try {
          const parsed = JSON.parse(previous?.owned_ships || "[]");
          if (Array.isArray(parsed)) {
            previousShips = parsed;
          }
        } catch (_) {}

        try {
          const parsed = JSON.parse(previous?.owned_extras || "[]");
          if (Array.isArray(parsed)) {
            previousExtras = parsed;
          }
        } catch (_) {}


        // También conservar para siempre los ITEM ganados
        // mediante torneos.
        const rewardItemsResult = await env.DB.prepare(`
          SELECT DISTINCT reward_value
          FROM player_rewards
          WHERE player_id = ?
            AND reward_type = 'ITEM'
        `).bind(playerId).all();

        const rewardItems = (rewardItemsResult.results || [])
          .map(row => String(row.reward_value || "").trim())
          .filter(Boolean);


        const ownedShips = [
          ...new Set([
            ...previousShips,
            ...incomingShips,
            ...rewardItems
          ])
        ];

        const ownedExtras = [
          ...new Set([
            ...previousExtras,
            ...incomingExtras
          ])
        ];


        // Asegurar que el jugador exista.
        await env.DB.prepare(`
          INSERT INTO players (
            player_id,
            display_name,
            last_seen_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(player_id) DO UPDATE SET
            display_name = excluded.display_name,
            last_seen_at = CURRENT_TIMESTAMP
        `).bind(
          playerId,
          typeof body.player_name === "string" &&
          body.player_name.trim()
            ? body.player_name.trim().slice(0, 50)
            : playerId
        ).run();


        // Guardar progreso.
        await env.DB.prepare(`
          INSERT INTO player_progress (
            player_id,
            coins,
            high_score,
            owned_ships,
            equipped_ship,
            owned_extras,
            equipped_extra,
            login_streak,
            last_login_date,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

          ON CONFLICT(player_id) DO UPDATE SET
            coins = excluded.coins,

            high_score =
              CASE
                WHEN excluded.high_score > player_progress.high_score
                THEN excluded.high_score
                ELSE player_progress.high_score
              END,

            owned_ships = excluded.owned_ships,
            equipped_ship = excluded.equipped_ship,
            owned_extras = excluded.owned_extras,
            equipped_extra = excluded.equipped_extra,

            login_streak = CASE
              WHEN excluded.last_login_date IS NULL
                   OR excluded.last_login_date = ''
                THEN player_progress.login_streak

              WHEN player_progress.last_login_date IS NULL
                   OR player_progress.last_login_date = ''
                THEN excluded.login_streak

              WHEN CAST(excluded.last_login_date AS INTEGER) >
                   CAST(player_progress.last_login_date AS INTEGER)
                THEN excluded.login_streak

              WHEN CAST(excluded.last_login_date AS INTEGER) =
                   CAST(player_progress.last_login_date AS INTEGER)
                THEN MAX(
                  player_progress.login_streak,
                  excluded.login_streak
                )

              ELSE player_progress.login_streak
            END,

            last_login_date = CASE
              WHEN excluded.last_login_date IS NULL
                   OR excluded.last_login_date = ''
                THEN player_progress.last_login_date

              WHEN player_progress.last_login_date IS NULL
                   OR player_progress.last_login_date = ''
                THEN excluded.last_login_date

              WHEN CAST(excluded.last_login_date AS INTEGER) >
                   CAST(player_progress.last_login_date AS INTEGER)
                THEN excluded.last_login_date

              ELSE player_progress.last_login_date
            END,

            updated_at = CURRENT_TIMESTAMP
        `).bind(
          playerId,
          coins,
          highScore,
          JSON.stringify(ownedShips),
          equippedShip,
          JSON.stringify(ownedExtras),
          equippedExtra,
          loginStreak,
          lastLoginDate
        ).run();


        const saved = await env.DB.prepare(`
          SELECT
            player_id,
            coins,
            high_score,
            owned_ships,
            equipped_ship,
            owned_extras,
            equipped_extra,
            login_streak,
            last_login_date,
            updated_at
          FROM player_progress
          WHERE player_id = ?
          LIMIT 1
        `).bind(playerId).first();


        return json({
          success: true,
          saved: true,
          progress: {
            player_id: saved.player_id,
            coins: Number(saved.coins || 0),
            high_score: Number(saved.high_score || 0),
            owned_ships: JSON.parse(saved.owned_ships || "[]"),
            equipped_ship: saved.equipped_ship || null,
            owned_extras: JSON.parse(saved.owned_extras || "[]"),
            equipped_extra: saved.equipped_extra || null,
            login_streak: Number(saved.login_streak || 0),
            last_login_date: saved.last_login_date || null,
            updated_at: saved.updated_at
          }
        });
      }


      // ============================================================
      // TOP MUNDIAL
      // Top 10 + posición personal. Nunca expone player_id.
      // ============================================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/leaderboard"
      ) {
        const playerId =
          (url.searchParams.get("player_id") || "").trim();

        if (playerId.length > 200) {
          return json({
            success: false,
            error: "player_id inválido"
          }, 400);
        }

        const topResult = await env.DB.prepare(`
          SELECT
            p.display_name AS player_name,
            pp.high_score,
            pp.updated_at
          FROM player_progress pp
          LEFT JOIN players p
            ON p.player_id = pp.player_id
          WHERE pp.high_score > 0
          ORDER BY
            pp.high_score DESC,
            pp.updated_at ASC,
            pp.player_id ASC
          LIMIT 10
        `).all();

        const top = (topResult.results || []).map((row, index) => ({
          rank: index + 1,
          player_name:
            typeof row.player_name === "string" && row.player_name.trim()
              ? row.player_name.trim().slice(0, 50)
              : "Jugador",
          high_score: Number(row.high_score || 0)
        }));

        let me = null;

        if (playerId) {
          const own = await env.DB.prepare(`
            SELECT
              pp.player_id,
              pp.high_score,
              pp.updated_at,
              p.display_name AS player_name
            FROM player_progress pp
            LEFT JOIN players p
              ON p.player_id = pp.player_id
            WHERE pp.player_id = ?
              AND pp.high_score > 0
            LIMIT 1
          `).bind(playerId).first();

          if (own) {
            const rankRow = await env.DB.prepare(`
              SELECT COUNT(*) + 1 AS rank
              FROM player_progress
              WHERE high_score > 0
                AND (
                  high_score > ?
                  OR (
                    high_score = ?
                    AND (
                      updated_at < ?
                      OR (
                        updated_at = ?
                        AND player_id < ?
                      )
                    )
                  )
                )
            `).bind(
              Number(own.high_score || 0),
              Number(own.high_score || 0),
              own.updated_at,
              own.updated_at,
              playerId
            ).first();

            me = {
              rank: Number(rankRow?.rank || 1),
              player_name:
                typeof own.player_name === "string" &&
                own.player_name.trim()
                  ? own.player_name.trim().slice(0, 50)
                  : "Jugador",
              high_score: Number(own.high_score || 0)
            };
          }
        }

        return json({
          success: true,
          top,
          me
        });
      }


      // ============================================================
      // TORNEO ACTIVO
      // ============================================================

      if (
        request.method === "GET" &&
        (
          url.pathname === "/" ||
          url.pathname === "/api/tournaments/active"
        )
      ) {
        const tournament = await env.DB.prepare(`
          SELECT
            id,
            name,
            description,
            challenge_type,
            challenge_target,
            reward_coins,
            reward_item,
            starts_at,
            ends_at,
            status,
            winner_player_id
          FROM tournaments
          WHERE status = 'active'
          ORDER BY id DESC
          LIMIT 1
        `).first();

        return json({
          success: true,
          tournament: tournament || null
        });
      }


      // ============================================================
      // PARTICIPANTES
      // ============================================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/tournaments/participants"
      ) {
        const tournamentId =
          Number(url.searchParams.get("tournament_id"));

        if (
          !Number.isInteger(tournamentId) ||
          tournamentId <= 0
        ) {
          return json({
            success: false,
            error: "tournament_id inválido"
          }, 400);
        }

        const result = await env.DB.prepare(`
          SELECT
            player_id,
            player_name,
            joined_at,
            completed_at
          FROM tournament_participants
          WHERE tournament_id = ?
          ORDER BY joined_at ASC, id ASC
        `).bind(tournamentId).all();

        return json({
          success: true,
          participants: result.results || []
        });
      }


      // ============================================================
      // PARTICIPAR
      // ============================================================

      if (
        request.method === "POST" &&
        url.pathname === "/api/tournaments/join"
      ) {
        const body = await request.json();

        const tournamentId =
          Number(body.tournament_id);

        const playerId =
          typeof body.player_id === "string"
            ? body.player_id.trim()
            : "";

        const playerName =
          typeof body.player_name === "string"
            ? body.player_name.trim().slice(0, 50)
            : "";

        if (
          !Number.isInteger(tournamentId) ||
          tournamentId <= 0 ||
          !playerId ||
          playerId.length > 200
        ) {
          return json({
            success: false,
            error: "Datos de inscripción inválidos"
          }, 400);
        }

        const tournament = await env.DB.prepare(`
          SELECT
            id,
            status,
            winner_player_id
          FROM tournaments
          WHERE id = ?
          LIMIT 1
        `).bind(tournamentId).first();

        if (!tournament) {
          return json({
            success: false,
            error: "Torneo no encontrado"
          }, 404);
        }

        if (tournament.status !== "active") {
          return json({
            success: false,
            error: "El torneo no está activo"
          }, 409);
        }

        if (tournament.winner_player_id) {
          return json({
            success: false,
            error: "El torneo ya finalizó"
          }, 409);
        }

        await env.DB.prepare(`
          INSERT INTO players (
            player_id,
            display_name,
            last_seen_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(player_id) DO UPDATE SET
            display_name = excluded.display_name,
            last_seen_at = CURRENT_TIMESTAMP
        `).bind(
          playerId,
          playerName || playerId
        ).run();

        await env.DB.prepare(`
          INSERT INTO tournament_participants (
            tournament_id,
            player_id,
            player_name
          )
          VALUES (?, ?, ?)
          ON CONFLICT(tournament_id, player_id)
          DO UPDATE SET
            player_name = excluded.player_name
        `).bind(
          tournamentId,
          playerId,
          playerName || playerId
        ).run();

        return json({
          success: true,
          joined: true
        });
      }


      // ============================================================
      // COMPLETAR DESAFÍO Y DECIDIR GANADOR
      // ============================================================

      if (
        request.method === "POST" &&
        url.pathname === "/api/tournaments/complete"
      ) {
        const body = await request.json();

        const tournamentId =
          Number(body.tournament_id);

        const playerId =
          typeof body.player_id === "string"
            ? body.player_id.trim()
            : "";

        if (
          !Number.isInteger(tournamentId) ||
          tournamentId <= 0 ||
          !playerId ||
          playerId.length > 200
        ) {
          return json({
            success: false,
            error: "Datos inválidos"
          }, 400);
        }

        const participant = await env.DB.prepare(`
          SELECT id
          FROM tournament_participants
          WHERE tournament_id = ?
            AND player_id = ?
          LIMIT 1
        `).bind(
          tournamentId,
          playerId
        ).first();

        if (!participant) {
          return json({
            success: false,
            error: "El jugador no está inscrito"
          }, 403);
        }

        await env.DB.prepare(`
          UPDATE tournament_participants
          SET completed_at =
            COALESCE(
              completed_at,
              CURRENT_TIMESTAMP
            )
          WHERE tournament_id = ?
            AND player_id = ?
        `).bind(
          tournamentId,
          playerId
        ).run();

        await env.DB.prepare(`
          UPDATE tournaments
          SET winner_player_id = ?
          WHERE id = ?
            AND status = 'active'
            AND winner_player_id IS NULL
        `).bind(
          playerId,
          tournamentId
        ).run();

        const tournament = await env.DB.prepare(`
          SELECT
            id,
            winner_player_id,
            reward_coins,
            reward_item
          FROM tournaments
          WHERE id = ?
          LIMIT 1
        `).bind(tournamentId).first();

        if (!tournament) {
          return json({
            success: false,
            error: "Torneo no encontrado"
          }, 404);
        }

        const won =
          tournament.winner_player_id === playerId;

        // Crear derechos de premio para el ganador.
        // UNIQUE de player_rewards evita duplicados.
        if (won) {

          if (Number(tournament.reward_coins) > 0) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO player_rewards (
                tournament_id,
                player_id,
                reward_type,
                reward_value
              )
              VALUES (?, ?, 'COINS', ?)
            `).bind(
              tournamentId,
              playerId,
              String(tournament.reward_coins)
            ).run();
          }

          if (tournament.reward_item) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO player_rewards (
                tournament_id,
                player_id,
                reward_type,
                reward_value
              )
              VALUES (?, ?, 'ITEM', ?)
            `).bind(
              tournamentId,
              playerId,
              String(tournament.reward_item)
            ).run();
          }
        }

        const winner =
          tournament.winner_player_id
            ? await env.DB.prepare(`
                SELECT
                  player_id,
                  player_name
                FROM tournament_participants
                WHERE tournament_id = ?
                  AND player_id = ?
                LIMIT 1
              `).bind(
                tournamentId,
                tournament.winner_player_id
              ).first()
            : null;

        return json({
          success: true,
          won,
          winner_player_id:
            tournament.winner_player_id || null,
          winner_name:
            winner?.player_name || null
        });
      }


      // ============================================================
      // CONSULTAR PREMIOS PENDIENTES
      // ============================================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/rewards/pending"
      ) {
        const playerId =
          (url.searchParams.get("player_id") || "").trim();

        if (!playerId) {
          return json({
            success: false,
            error: "player_id requerido"
          }, 400);
        }

        const result = await env.DB.prepare(`
          SELECT
            id,
            tournament_id,
            reward_type,
            reward_value,
            granted_at
          FROM player_rewards
          WHERE player_id = ?
            AND claimed_at IS NULL
          ORDER BY id ASC
        `).bind(playerId).all();

        return json({
          success: true,
          rewards: result.results || []
        });
      }


      // ============================================================
      // RECLAMAR UN PREMIO
      // ============================================================

      if (
        request.method === "POST" &&
        url.pathname === "/api/rewards/claim"
      ) {
        const body =
          await request.json();

        const rewardId =
          Number(body.reward_id);

        const playerId =
          typeof body.player_id === "string"
            ? body.player_id.trim()
            : "";

        if (
          !Number.isInteger(rewardId) ||
          rewardId <= 0 ||
          !playerId
        ) {
          return json({
            success: false,
            error: "Datos de premio inválidos"
          }, 400);
        }

        const reward =
          await env.DB.prepare(`
            SELECT
              id,
              tournament_id,
              player_id,
              reward_type,
              reward_value,
              claimed_at
            FROM player_rewards
            WHERE id = ?
              AND player_id = ?
            LIMIT 1
          `).bind(
            rewardId,
            playerId
          ).first();

        if (!reward) {
          return json({
            success: false,
            error: "Premio no encontrado"
          }, 404);
        }

        if (reward.claimed_at) {
          return json({
            success: false,
            error: "Premio ya reclamado"
          }, 409);
        }

        // Marcamos exactamente este premio como reclamado.
        const result =
          await env.DB.prepare(`
            UPDATE player_rewards
            SET claimed_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND player_id = ?
              AND claimed_at IS NULL
          `).bind(
            rewardId,
            playerId
          ).run();

        if (
          !result.meta ||
          result.meta.changes !== 1
        ) {
          return json({
            success: false,
            error: "El premio ya fue reclamado"
          }, 409);
        }

        return json({
          success: true,
          claimed: true,
          reward: {
            id: reward.id,
            tournament_id:
              reward.tournament_id,
            type:
              reward.reward_type,
            value:
              reward.reward_value
          }
        });
      }


      // ============================================================
      // RUTA NO ENCONTRADA
      // ============================================================

      return json({
        success: false,
        error: "Not found"
      }, 404);

    } catch (error) {
      return json({
        success: false,
        error: error.message
      }, 500);
    }
  }
};