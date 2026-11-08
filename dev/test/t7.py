# Dice room: the GM asks players for tests, contests and other rolls; each side rolls on their own device
# and the app compares. Runs over http against the fake Firebase (which mirrors firestore.rules).
import asyncio, subprocess, re, socket
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
OUT = ROOT / 'test' / 'out' / 't7'; OUT.mkdir(parents=True, exist_ok=True)
FAKE = (ROOT / 'test' / 'fake' / 'fake-firebase.js').read_text(encoding='utf-8')
SITE_CFG = "window.PF_FIREBASE = { apiKey: 'AIzaFakeKey123', authDomain: 'demo-forge.firebaseapp.com', projectId: 'demo-forge', appId: '1:1:web:abc' };"
problems = []

async def mkpage(b, name, port, google=None, gname=None, mobile=False):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900})
    await ctx.add_init_script(f"window.FAKE_FB_URL='http://127.0.0.1:{port}';" + (f"window.FAKE_GOOGLE_EMAIL='{google}';window.FAKE_GOOGLE_NAME='{gname}';" if google else '') + SITE_CFG + FAKE)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: problems.append(f'{name} pageerror: {e}'))
    pg.on('console', lambda m: problems.append(f'{name} console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    return pg

async def until(pg, js, what, timeout=8000):
    try: await pg.wait_for_function(js, timeout=timeout)
    except Exception:
        info = await pg.evaluate("JSON.stringify({status: NET.status, tab: DB.ui.tab, checks: Object.values(NET.checks || {}).flat().map(c => [c.type, c.status, c.turn, (c.rounds||[]).map(r => r.side + ':' + r.total + (r.giveIn ? 'G' : '')).join(' '), c.winner]), toasts: [...document.querySelectorAll('#toasts > *')].map(t => t.textContent)})")
        raise AssertionError('timed out waiting for: ' + what + '\n' + info)

async def signup(pg, name, email, pw):
    await until(pg, "!!document.querySelector('[data-act=netAuthMode][data-m=up]')", 'auth panel')
    await pg.click('[data-act="netAuthMode"][data-m="up"]')
    await pg.fill('[data-bind="N.name"]', name); await pg.fill('[data-bind="N.email"]', email); await pg.fill('#netPw', pw)
    await pg.click('[data-act="netEmailGo"]')
    await until(pg, "NET.status === 'online' && !!NET.user", name + ' signed up')

def rig(v): return f"Math.random = () => {v};"
UNRIG = "Math.random = window.__realRandom || Math.random;"

async def player_roll(pg, dice, rnd=None):
    """Build a pool from loose dice on the dice tab, roll it (optionally rigged), return the total."""
    await pg.evaluate("DB.ui.tab = 'dice'; POOL.own = []; POOL.res = []; render()")
    for d in dice: await pg.click(f'[data-act="poolAddDie"][data-die="{d}"]')
    if rnd is not None: await pg.evaluate("window.__realRandom = window.__realRandom || Math.random;" + rig(rnd))
    await pg.click('[data-act="rollPool"]')
    if rnd is not None: await pg.evaluate(UNRIG)
    return await pg.evaluate("outcome(Object.assign({}, POOL.last, { target: null }), curS()).total")

async def gm_opp(gm, dice, rnd=None):
    await gm.evaluate("DB.ui.tab = 'dice'; DB.ui.oppMode = 'dice'; POOL.opp = []; POOL.oppBase = []; POOL.opRoll = null; render()")
    for d in dice: await gm.click(f'[data-act="oppAddDie"][data-die="{d}"]')
    if rnd is not None: await gm.evaluate("window.__realRandom = window.__realRandom || Math.random;" + rig(rnd))
    await gm.click('[data-act="rollOpp"]')
    if rnd is not None: await gm.evaluate(UNRIG)
    return await gm.evaluate("oppTotalNow(POOL.opRoll)")

async def ask(gm, uid, kind, label, opt=None):
    await gm.evaluate("DB.ui.tab = 'dice'; render()")
    await gm.click(f'[data-act="netAsk"][data-uid="{uid}"]')
    await gm.click(f'#askType button[data-v="{kind}"]')
    await gm.fill('#askLabel', label)
    if opt:
        sel, val = opt
        await gm.select_option(sel, val)
    await gm.click('#askGo')

def latest(kind): return f"(Object.values(NET.checks || {{}}).flat().filter(c => c.type === '{kind}').sort((a, b) => b.created - a.created)[0] || {{}})"

async def main():
    srv = subprocess.Popen(['node', str(ROOT / 'test' / 'fake' / 'server.js')], stdout=subprocess.PIPE, text=True)
    port = int(re.search(r'PORT (\d+)', srv.stdout.readline()).group(1))
    sk = socket.socket(); sk.bind(('127.0.0.1', 0)); hport = sk.getsockname()[1]; sk.close()
    web = subprocess.Popen(['python3', '-m', 'http.server', str(hport), '--bind', '127.0.0.1'], cwd=ROOT / 'dist', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    GM_URL = f'http://127.0.0.1:{hport}/prime-forge.html'; PLAY_URL = f'http://127.0.0.1:{hport}/play.html'
    await asyncio.sleep(0.7)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            gm = await mkpage(b, 'gm', port)
            await gm.goto(GM_URL); await gm.wait_for_timeout(300)
            await gm.evaluate("""() => { const s = newSetting('Ashes of the Earth Kingdom');
              const a = newSet('attributes'); a.traits = ['Body','Mind','Spirit'].map(n => newTrait(n)); s.sets.push(a);
              DB.settings[s.id] = s; DB.ui.settingId = s.id; DB.ui.tab = 'online'; save(); render(); }""")
            await signup(gm, 'Nixxen', 'nixxen@example.com', 'firelord1')
            await gm.click('[data-act="netCreate"]'); await gm.click('#cfYes')
            await until(gm, "Object.values(NET.meta).some(m => m.code)", 'campaign online')
            tid = await gm.evaluate("Object.keys(DB.net.tables)[0]")
            code = await gm.evaluate(f"NET.meta['{tid}'].code")

            sam = await mkpage(b, 'sam', port)
            await sam.goto(PLAY_URL + '#code=' + code)
            await signup(sam, 'Sam', 'sam@example.com', 'appa4ever')
            await until(sam, "!!document.querySelector('[data-act=netJoinGo]')", 'sam join card'); await sam.click('[data-act="netJoinGo"]')
            await until(sam, "DB.ui.tab === 'chars' && !!curS()", 'sam in campaign')
            await sam.click('[data-act="newChar"]'); await sam.fill('[data-bind="C.name"]', 'Kira'); await sam.click('h1')
            samUid = await sam.evaluate("netUid()")
            await until(gm, f"Object.values(DB.chars).some(c => c.name === 'Kira') && (NET.members['{tid}']||[]).some(m => m.uid === '{samUid}')", 'GM sees Sam and Kira')
            kira = await gm.evaluate("Object.values(DB.chars).find(c => c.name === 'Kira').id")

            lee = await mkpage(b, 'lee', port, google='lee@example.com', gname='Lee', mobile=True)
            await lee.goto(PLAY_URL + '#code=' + code)
            await until(lee, "!!document.querySelector('[data-act=netGoogle]')", 'lee auth'); await lee.click('[data-act="netGoogle"]')
            await until(lee, "!!document.querySelector('[data-act=netJoinGo]')", 'lee join card'); await lee.click('[data-act="netJoinGo"]')
            await until(lee, "DB.ui.tab === 'chars' && !!curS()", 'lee in campaign')
            leeUid = await lee.evaluate("netUid()")

            # the player app has no opposition dice at all
            await sam.evaluate("DB.ui.tab = 'dice'; render()"); await sam.wait_for_timeout(150)
            assert await sam.locator('[data-act="rollOpp"]').count() == 0, 'players can roll opposition'
            assert 'Dice room' in await sam.evaluate("tabsFor().map(t => t.label).join()")

            # ---------- 1. a test against a static difficulty ----------
            await until(gm, f"(NET.members['{tid}']||[]).length === 3", 'GM sees both players')
            await gm.evaluate("DB.ui.tab = 'dice'; render()"); await gm.wait_for_timeout(150)
            assert await gm.locator('.askrow [data-act="netAsk"]').count() == 2
            await gm.screenshot(path=str(OUT / '01-gm-room.png'), full_page=True)
            await ask(gm, samUid, 'test', 'Climb the palace wall', ('#askDiff', 's11'))
            await until(sam, "!!document.querySelector('.netask')", 'Sam sees Your roll pill')
            await sam.click('.netask')
            await until(sam, "DB.ui.tab === 'dice' && !!document.querySelector('.checkcard.myturn')", 'Sam on the dice room with his turn')
            assert await sam.evaluate(f"POOL.charId === '{kira}'"), 'pool not set to Kira'
            assert await sam.evaluate("netCheckTarget()") == 11
            t = await player_roll(sam, [8, 10])
            await until(sam, "!!document.querySelector('[data-act=netLockIn]')", 'lock-in button')
            await sam.screenshot(path=str(OUT / '02-sam-lockin.png'), full_page=True)
            await sam.click('[data-act="netLockIn"]')
            await until(gm, f"{latest('test')}.status === 'done'", 'test resolved on GM side')
            w = await gm.evaluate(f"{latest('test')}.winner")
            assert w == ('player' if t > 11 else 'gm'), (t, w)
            if t >= 16: assert await gm.evaluate(f"{latest('test')}.heroic") >= 1
            await until(sam, "!document.querySelector('.netask')", 'pill gone')

            # ---------- 2. a test where the GM rolls difficulty dice first ----------
            await ask(gm, samUid, 'test', 'Calm the sky bison', ('#askDiff', 'd6,6'))
            await until(gm, f"{latest('test')}.turn === 'gm' && !!document.querySelector('.netask')", 'GM turn on dice test')
            assert await gm.evaluate("(POOL.oppBase || []).join()") == '6,6', 'difficulty dice not preset'
            await gm.evaluate("DB.ui.tab = 'dice'; render()")
            await gm.evaluate("window.__realRandom = Math.random;" + rig(0.5))
            await gm.click('[data-act="rollOpp"]'); await gm.evaluate(UNRIG)
            diff = await gm.evaluate("oppTotalNow(POOL.opRoll)")
            await until(gm, "!!document.querySelector('[data-act=netLockIn]')", 'GM lock-in')
            await gm.click('[data-act="netLockIn"]')
            await until(sam, f"{latest('test')}.turn === 'player' && !!document.querySelector('.checkcard.myturn')", 'Sam turn after difficulty')
            assert await sam.evaluate("netCheckTarget()") == diff
            t2 = await player_roll(sam, [12, 12], rnd=0.999)  # 12 + 12
            await sam.click('[data-act="netLockIn"]')
            await until(gm, f"{latest('test')}.status === 'done' && {latest('test')}.winner === 'player'", 'Sam beats the dice difficulty')
            assert await gm.evaluate(f"{latest('test')}.heroic") == (t2 - diff) // 5

            # ---------- 3. a contest: Sam starts, the GM beats him, Sam gives in for a plot point ----------
            pp0 = await sam.evaluate(f"DB.chars['{kira}'].pp")
            await ask(gm, samUid, 'contest', 'Shove past the guard', ('#askFirst', 'player'))
            await until(sam, f"{latest('contest')}.turn === 'player'", 'Sam starts the contest')
            s1 = await player_roll(sam, [6, 6], rnd=0.5)
            await sam.click('[data-act="netLockIn"]')
            await until(gm, f"{latest('contest')}.turn === 'gm' && !!document.querySelector('.netask')", 'GM turn in contest')
            g1 = await gm_opp(gm, [12, 12], rnd=0.999)
            assert g1 > s1
            await gm.click('[data-act="netLockIn"]')
            await until(sam, f"{latest('contest')}.turn === 'player' && !!document.querySelector('[data-act=netGiveIn]')", 'Sam can give in')
            # Sam can't rewrite earlier rounds, and Lee can't answer for him
            hack = await sam.evaluate(f"""async () => {{ const c = {latest('contest')}; const n = c.rounds.length;
              try {{ await tableRef('{tid}').collection('checks').doc(c.id).update({{ 'rounds.r1.total': 0, ['rounds.r' + n]: {{ side: 'player', total: 99, effect: 12, dice: [], hitches: 0, botch: false, at: 1 }}, n: n + 1, turn: null, status: 'done', winner: 'player', at: 2 }}); return 'allowed'; }} catch (e) {{ return e.code; }} }}""")
            assert hack == 'permission-denied', hack
            hack2 = await lee.evaluate(f"""async () => {{ const c = {latest('contest')}; const n = c.rounds.length;
              try {{ await tableRef('{tid}').collection('checks').doc(c.id).update({{ ['rounds.r' + n]: {{ side: 'player', total: 99, effect: 12, dice: [], hitches: 0, botch: false, at: 1 }}, n: n + 1, at: 2 }}); return 'allowed'; }} catch (e) {{ return e.code; }} }}""")
            assert hack2 == 'permission-denied', hack2
            hack3 = await sam.evaluate(f"""async () => {{ const c = {latest('contest')}; const n = c.rounds.length;
              try {{ await tableRef('{tid}').collection('checks').doc(c.id).update({{ ['rounds.r' + n]: {{ side: 'gm', total: 1, effect: 4, dice: [], hitches: 0, botch: false, at: 1 }}, n: n + 1, at: 2 }}); return 'allowed'; }} catch (e) {{ return e.code; }} }}""")
            assert hack3 == 'permission-denied', hack3
            await sam.click('[data-act="netGiveIn"]'); await sam.click('#cfYes')
            await until(gm, f"{latest('contest')}.status === 'done' && {latest('contest')}.winner === 'gm'", 'contest over after giving in')
            await until(sam, f"DB.chars['{kira}'].pp === {pp0 + 1}", 'Kira earned a plot point')
            await until(gm, f"DB.chars['{kira}'].pp === {pp0 + 1}", 'GM sees the plot point')
            await until(gm, "document.body.innerText.includes('gave in and earns 1 plot point')", 'give-in verdict')
            await gm.screenshot(path=str(OUT / '03-gm-contest.png'), full_page=True)

            # ---------- 4. a contest the GM starts, and the player fails to beat it ----------
            await ask(gm, samUid, 'contest', 'The guard grabs Kira', ('#askFirst', 'gm'))
            await until(gm, f"{latest('contest')}.turn === 'gm' && {latest('contest')}.label === 'The guard grabs Kira'", 'GM rolls first')
            g2 = await gm_opp(gm, [8, 8], rnd=0.5)   # 5 + 5
            await gm.click('[data-act="netLockIn"]')
            await until(sam, f"{latest('contest')}.turn === 'player' && {latest('contest')}.label === 'The guard grabs Kira'", 'Sam to beat GM')
            s2 = await player_roll(sam, [4, 4], rnd=0.0)   # botch
            await sam.click('[data-act="netLockIn"]')
            await until(gm, f"{latest('contest')}.status === 'done' && {latest('contest')}.winner === 'gm'", 'GM wins when Sam fails to beat')
            assert await gm.evaluate(f"{latest('contest')}.heroic") == (g2 - s2) // 5

            # ---------- 5. an "other" roll for Lee, both rolling ----------
            await ask(gm, leeUid, 'other', 'Initiative', ('#askBoth', 'pg'))
            await until(lee, "!!document.querySelector('.netask')", 'Lee sees pill')
            await lee.click('.netask')
            l1 = await player_roll(lee, [8, 6], rnd=0.7)
            await lee.click('[data-act="netLockIn"]')
            await until(gm, f"{latest('other')}.turn === 'gm'", 'GM turn on other')
            g3 = await gm_opp(gm, [6, 6], rnd=0.2)
            await gm.click('[data-act="netLockIn"]')
            await until(lee, f"{latest('other')}.status === 'done'", 'other done on Lee side')
            w3 = await lee.evaluate(f"{latest('other')}.winner")
            assert w3 == (None if l1 == g3 else 'player' if l1 > g3 else 'gm'), (l1, g3, w3)
            await lee.screenshot(path=str(OUT / '04-lee-mobile.png'), full_page=True)
            sw = await lee.evaluate("document.documentElement.scrollWidth"); assert sw <= 390, f'horizontal scroll {sw}'

            # ---------- same browser: the player app doesn't inherit the GM app's sign-in ----------
            pp2 = await gm.context.new_page()
            pp2.on('pageerror', lambda e: problems.append(f'gm-tab-play pageerror: {e}'))
            await pp2.goto(PLAY_URL)
            await until(pp2, "NET.status === 'signedout'", 'player app signed out in the GM browser')
            await signup(pp2, 'Toph', 'toph@example.com', 'metalbend')
            gmUid = await gm.evaluate("NET.user.uid")
            assert gmUid != await pp2.evaluate("NET.user.uid")
            await gm.reload()
            await until(gm, f"NET.status === 'online' && NET.user.uid === '{gmUid}'", 'GM app still the GM after the player app signed in')
            await pp2.close()

            # ---------- 6. cancel and clear ----------
            await ask(gm, leeUid, 'test', 'Never mind', ('#askDiff', 's7'))
            await until(lee, "!!document.querySelector('.netask')", 'Lee asked again')
            await gm.click('.checkcard.open [data-act="netCheckCancel"]')
            await until(lee, "!document.querySelector('.netask')", 'cancel clears Lee pill')
            await gm.click('[data-act="netChecksClear"]')
            await until(gm, f"(NET.checks['{tid}']||[]).length === 0", 'finished rolls cleared')
            await gm.screenshot(path=str(OUT / '05-gm-cleared.png'), full_page=True)
            await b.close()
    finally:
        srv.kill(); web.kill()
    print('\n'.join(problems) if problems else 'no errors')

asyncio.run(main())
