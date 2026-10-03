"""Check real Worker progress SQL rejects a stale save after paid credit."""
import re
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / 'src/worker.js').read_text()
post = source.split('// GUARDAR / ACTUALIZAR PROGRESO', 1)[1]
sql = re.search(r'const write = await env\.DB\.prepare\(`([^\`]+)`\)', post).group(1)
db = sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE player_progress (
 player_id TEXT PRIMARY KEY, coins INTEGER NOT NULL, high_score INTEGER,
 owned_ships TEXT, equipped_ship TEXT, owned_extras TEXT, equipped_extra TEXT,
 login_streak INTEGER, last_login_date TEXT, updated_at TEXT
);
""")
db.executescript((root / 'migrations/001_play_purchase_grants.sql').read_text())
args = ['p1', 100, 0, '[]', None, '[]', None, 0, None]
assert db.execute(sql, (*args, 0)).rowcount == 1
db.execute('UPDATE player_progress SET coins=coins+500000, purchase_revision=purchase_revision+1 WHERE player_id=?', ('p1',))
assert db.execute(sql, (*args, 0)).rowcount == 0
assert db.execute('SELECT coins FROM player_progress').fetchone()[0] == 500100
args[1] = 500080  # Player spent 20 coins after refreshing cloud revision.
assert db.execute(sql, (*args, 1)).rowcount == 1
assert db.execute('SELECT coins FROM player_progress').fetchone()[0] == 500080
print('Stale progress save protection: OK')
