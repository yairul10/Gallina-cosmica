"""Exercise the SQL embedded in creditVerifiedPurchase against SQLite."""
import hashlib
import re
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / 'src/play-purchase-verification.js').read_text()
fn = source.split('export async function creditVerifiedPurchase', 1)[1]
statements = re.findall(r'env\.DB\.prepare\(`([^\`]+)`\)', fn)
assert len(statements) == 6, len(statements)
db = sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE players (player_id TEXT PRIMARY KEY, display_name TEXT, last_seen_at TEXT);
CREATE TABLE player_progress (
 player_id TEXT PRIMARY KEY, coins INTEGER NOT NULL, high_score INTEGER,
 owned_ships TEXT, equipped_ship TEXT, owned_extras TEXT, equipped_extra TEXT,
 login_streak INTEGER, last_login_date TEXT, updated_at TEXT
);
""")
db.executescript((root / 'migrations/001_play_purchase_grants.sql').read_text())

def credit(token, player='p1', product='monedas_500000', coins=500000, entitlement=None):
    h = hashlib.sha256(token.encode()).hexdigest()
    with db:
        db.execute(statements[0], (player, player))
        db.execute(statements[1], (player,))
        db.execute(statements[2], (h, player, product, coins, entitlement, '', 0))
        changed = db.execute(statements[3], (coins, player, h, player, product)).rowcount
        db.execute(statements[4], (h, player, product))
    return changed

assert credit('token-a') == 1
assert credit('token-a') == 0
assert db.execute('SELECT coins FROM player_progress WHERE player_id=?', ('p1',)).fetchone()[0] == 500000
assert credit('token-a', 'p2') == 0
assert db.execute('SELECT coins FROM player_progress WHERE player_id=?', ('p2',)).fetchone()[0] == 0
assert credit('pack-a', product='pack_inicial', coins=100000, entitlement='pack_inicial') == 1
try:
    credit('pack-b', product='pack_inicial', coins=100000, entitlement='pack_inicial')
    raise AssertionError('duplicate permanent pack was allowed')
except sqlite3.IntegrityError:
    pass
assert db.execute('SELECT coins FROM player_progress WHERE player_id=?', ('p1',)).fetchone()[0] == 600000
assert db.execute('SELECT COUNT(*) FROM play_purchase_grants').fetchone()[0] == 2
print('Atomic purchase credit SQL: OK')
