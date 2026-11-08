# Online campaigns: the GM in Prime Forge, players in the player app, each in their own browser,
# against the fake Firebase in test/fake (which mirrors firestore.rules).
import asyncio, subprocess, re, json
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
GM_URL = PLAY_URL = None   # served over http like the real site (file:// storage is flaky across reloads in Chromium)
OUT = ROOT / 'test' / 'out' / 't5'; OUT.mkdir(parents=True, exist_ok=True)
FAKE = (ROOT / 'test' / 'fake' / 'fake-firebase.js').read_text(encoding='utf-8')
CFG = 'const firebaseConfig = {\n  apiKey: "AIzaFakeKey123",\n  authDomain: "demo-forge.firebaseapp.com",\n  projectId: "demo-forge",\n  storageBucket: "demo-forge.appspot.com",\n  messagingSenderId: "1",\n  appId: "1:1:web:abc"\n};'
SITE_CFG = "window.PF_FIREBASE = { apiKey: 'AIzaFakeKey123', authDomain: 'demo-forge.firebaseapp.com', projectId: 'demo-forge', appId: '1:1:web:abc' };"
problems = []

async def mkpage(browser, name, port, google=None, gname=None, site_cfg=True, mobile=False):
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900})
    init = f"window.FAKE_FB_URL='http://127.0.0.1:{port}';" + (f"window.FAKE_GOOGLE_EMAIL='{google}';" if google else '') + (f"window.FAKE_GOOGLE_NAME='{gname}';" if gname else '') + (SITE_CFG if site_cfg else '') + FAKE
    await ctx.add_init_script(init)
    async def nocfg(route): await route.fulfill(content_type='text/javascript', body='window.PF_FIREBASE = null;')
    await ctx.route('**/firebase-config.js', nocfg)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: problems.append(f'{name} pageerror: {e}'))
    pg.on('console', lambda m: problems.append(f'{name} console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    return pg

async def until(pg, js, what, timeout=8000):
    try: await pg.wait_for_function(js, timeout=timeout)
    except Exception:
        info = await pg.evaluate("JSON.stringify({status: NET.status, user: NET.user && NET.user.uid, err: NET.err, tables: DB.net.tables, joining: NET.joining, subs: Object.keys(NET.subs), chars: Object.values(DB.chars).map(c => [c.name, c.table, c.owner]), tab: DB.ui.tab, toasts: [...document.querySelectorAll('#toasts > *')].map(t => t.textContent)})")
        raise AssertionError('timed out waiting for: ' + what + '\n' + info)

async def signup(pg, name, email, pw):
    await until(pg, "!!document.querySelector('[data-act=netAuthMode][data-m=up]')", 'auth panel')
    await pg.click('[data-act="netAuthMode"][data-m="up"]')
    await pg.fill('[data-bind="N.name"]', name)
    await pg.fill('[data-bind="N.email"]', email)
    await pg.fill('#netPw', pw)
    await pg.click('[data-act="netEmailGo"]')
    await until(pg, "NET.status === 'online' && !!NET.user", f'{name} signed up')

async def signin(pg, email, pw, expect_ok=True):
    await until(pg, "!!document.querySelector('[data-act=netEmailGo]')", 'auth panel')
    await pg.fill('[data-bind="N.email"]', email)
    await pg.fill('#netPw', pw)
    await pg.click('[data-act="netEmailGo"]')
    if expect_ok: await until(pg, "NET.status === 'online' && !!NET.user", f'{email} signed in')

async def main():
    srv = subprocess.Popen(['node', str(ROOT / 'test' / 'fake' / 'server.js')], stdout=subprocess.PIPE, text=True)
    port = int(re.search(r'PORT (\d+)', srv.stdout.readline()).group(1))
    import socket
    sk = socket.socket(); sk.bind(('127.0.0.1', 0)); hport = sk.getsockname()[1]; sk.close()
    web = subprocess.Popen(['python3', '-m', 'http.server', str(hport), '--bind', '127.0.0.1'], cwd=ROOT / 'dist', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    global GM_URL, PLAY_URL
    GM_URL = f'http://127.0.0.1:{hport}/prime-forge.html'; PLAY_URL = f'http://127.0.0.1:{hport}/play.html'
    await asyncio.sleep(0.7)
    def dump():
        out = subprocess.run(['node', '-e', f"fetch('http://127.0.0.1:{port}/op',{{method:'POST',body:JSON.stringify({{op:'dump'}})}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(Object.keys(j.docs))))"], capture_output=True, text=True).stdout
        return json.loads(out)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            # ---------- GM in Prime Forge: connect a project, create an account, put a setting online ----------
            gm = await mkpage(b, 'gm', port, site_cfg=False)
            await gm.goto(GM_URL); await gm.wait_for_timeout(300)
            await gm.evaluate("""() => { const s = newSetting('Ashes of the Earth Kingdom'); s.tagline = 'The Avatar is gone.';
              const a = newSet('attributes'); a.traits = ['Body','Mind','Spirit'].map(n => newTrait(n)); s.sets.push(a);
              DB.settings[s.id] = s; const c = newChar(s); c.name = 'Old Iroh'; DB.chars[c.id] = c; DB.ui.settingId = s.id; DB.ui.tab = 'online'; save(); render(); }""")
            await gm.fill('#netCfgTxt', CFG)
            await gm.click('[data-act="netSaveCfg"]')
            await until(gm, "NET.status === 'signedout'", 'GM connected, signed out')
            await gm.screenshot(path=str(OUT / '01-gm-signin.png'), full_page=True)
            await signup(gm, 'Nixxen', 'nixxen@example.com', 'firelord1')
            await gm.click('[data-act="netCreate"]'); await gm.click('#cfYes')
            await until(gm, "Object.keys(DB.net.tables).length === 1 && Object.values(NET.meta).some(m => m.code)", 'campaign online with a code')
            tid = await gm.evaluate("Object.keys(DB.net.tables)[0]")
            code = await gm.evaluate(f"NET.meta['{tid}'].code")
            assert re.fullmatch(r'[A-Z2-9]{6}', code), code
            await until(gm, "document.querySelector('.codebig') && document.querySelector('.codebig').textContent.includes('-')", 'code shown')
            await until(gm, "Object.values(DB.chars).some(c => c.name === 'Old Iroh' && c.table)", 'GM char brought')
            await gm.screenshot(path=str(OUT / '02-gm-campaign.png'), full_page=True)

            # ---------- Sam: player app link with the code, creates an account, joins, makes Kira ----------
            p1 = await mkpage(b, 'p1', port)
            await p1.goto(PLAY_URL + '#code=' + code)
            await until(p1, "document.body.innerText.includes('Room code')", 'p1 sees code note')
            assert await p1.evaluate("tabsFor().map(t => t.id).join()") == 'home'
            await p1.screenshot(path=str(OUT / '03-p1-welcome.png'), full_page=True)
            await signup(p1, 'Sam', 'sam@example.com', 'appa4ever')
            await until(p1, "!!document.querySelector('[data-act=netJoinGo]')", 'p1 join card from code')
            await p1.click('[data-act="netJoinGo"]')
            await until(p1, "DB.ui.tab === 'chars' && curS() && curS().name === 'Ashes of the Earth Kingdom' && isLocked(curS())", 'p1 in campaign')
            tabs = await p1.evaluate("tabsFor().map(t => t.id).join()")
            assert tabs == 'home,chars,dice,rules,camp', tabs
            await until(p1, "Object.values(DB.chars).some(c => c.name === 'Old Iroh')", 'p1 sees GM char')
            await p1.click('[data-act="newChar"]')
            await p1.fill('[data-bind="C.name"]', 'Kira'); await p1.wait_for_timeout(100); await p1.click('h1')
            samUid = await p1.evaluate("netUid()")
            await until(gm, f"Object.values(DB.chars).some(c => c.name === 'Kira' && c.owner === '{samUid}' && c.ownerName === 'Sam')", 'GM sees Kira')
            kira = await gm.evaluate("Object.values(DB.chars).find(c => c.name === 'Kira').id")

            # setting changes reach the player; rolls reach the GM
            await gm.evaluate("() => { const S = Object.values(DB.settings)[0]; S.tagline = 'Ba Sing Se must be warned.'; touch(S); }")
            await until(p1, "curS().tagline === 'Ba Sing Se must be warned.'", 'p1 gets setting update')
            await p1.evaluate("DB.ui.tab = 'dice'; render()")
            await p1.click('[data-act="poolAddDie"][data-die="8"]'); await p1.click('[data-act="poolAddDie"][data-die="6"]')
            await p1.click('[data-act="rollPool"]')
            await until(gm, f"(NET.rolls['{tid}']||[]).some(r => r.name === 'Sam' && /rolled/.test(r.text))", 'GM sees roll')
            await p1.evaluate("DB.ui.tab = 'camp'; render()"); await p1.wait_for_timeout(200)
            await p1.screenshot(path=str(OUT / '04-p1-campaign.png'), full_page=True)

            # ---------- Lee: Google sign-in, joins by typing the code, can't touch Kira ----------
            p2 = await mkpage(b, 'p2', port, google='lee@example.com', gname='Lee')
            await p2.goto(PLAY_URL)
            await until(p2, "!!document.querySelector('[data-act=netGoogle]')", 'p2 auth panel')
            await p2.click('[data-act="netGoogle"]')
            await until(p2, "!!NET.user && !!document.querySelector('.codein')", 'p2 dashboard')
            await p2.fill('.codein', code[:3].lower() + '-' + code[3:].lower())
            await p2.click('[data-act="netCodeGo"]')
            await until(p2, "!!document.querySelector('#netJoinName')", 'p2 join card')
            assert await p2.input_value('#netJoinName') == 'Lee'
            await p2.click('[data-act="netJoinGo"]')
            await until(p2, f"!!DB.chars['{kira}'] && netReadOnly(DB.chars['{kira}'])", 'p2 sees Kira read-only')
            await p2.evaluate(f"DB.ui.charId = '{kira}'; DB.ui.cview = 'build'; render()")
            await until(p2, "document.body.innerText.includes('belongs to Sam')", 'read-only banner')
            denied = await p2.evaluate(f"""async () => {{ try {{ await tableRef('{tid}').collection('chars').doc('{kira}').set({{ owner: netUid(), ownerName: 'Lee', name: 'Stolen', hidden: false, json: '{{}}', updated: '', by: netUid(), at: 1 }}); return 'allowed'; }} catch (e) {{ return e.code; }} }}""")
            assert denied == 'permission-denied', denied
            listed = await p2.evaluate("async () => { try { await NET.db.collection('codes').get(); return 'allowed'; } catch (e) { return e.code; } }")
            assert listed == 'permission-denied', listed

            # ---------- Sam on a second device: sign in, Kira is there and editable ----------
            p1b = await mkpage(b, 'p1b', port, mobile=True)
            await p1b.goto(PLAY_URL)
            await signin(p1b, 'sam@example.com', 'wrong-pass', expect_ok=False)
            await until(p1b, "[...document.querySelectorAll('#toasts > *')].some(t => /don.t match/.test(t.textContent))", 'wrong password message')
            assert await p1b.evaluate("!NET.user")
            await signin(p1b, 'sam@example.com', 'appa4ever')
            await until(p1b, f"!!DB.chars['{kira}'] && netCanWrite(DB.chars['{kira}'])", 'Kira on second device')
            await p1b.screenshot(path=str(OUT / '05-p1b-dashboard-mobile.png'), full_page=True)
            sw = await p1b.evaluate("document.documentElement.scrollWidth"); assert sw <= 390, f'horizontal scroll {sw}'
            await p1b.click(f'[data-act="netOpenChar"][data-id="{kira}"]')
            await until(p1b, "DB.ui.tab === 'chars' && DB.ui.cview === 'file'", 'Kira sheet open')
            await p1b.screenshot(path=str(OUT / '06-p1b-sheet-mobile.png'), full_page=True)
            sw = await p1b.evaluate("document.documentElement.scrollWidth"); assert sw <= 390, f'horizontal scroll on sheet {sw}'
            await p1b.evaluate(f"() => {{ const c = DB.chars['{kira}']; c.concept = 'Waterbender courier'; touch(c); }}")
            await until(gm, f"DB.chars['{kira}'].concept === 'Waterbender courier'", 'GM sees second-device edit')
            await until(p1, f"DB.chars['{kira}'].concept === 'Waterbender courier'", 'first device sees it too')
            # signing out leaves nothing behind on that device
            await p1b.evaluate("DB.ui.tab = 'home'; render()")
            await p1b.click('[data-act="netSignOut"]'); await p1b.click('#cfYes')
            await until(p1b, "!NET.user && Object.keys(DB.chars).length === 0 && Object.keys(DB.settings).length === 0", 'wiped on sign-out')
            stored = await p1b.evaluate("localStorage.getItem('primeforge.play.v1') || ''")
            if 'Kira' in stored:
                j = json.loads(stored); hits = [k for k in j if 'Kira' in json.dumps(j[k])]
                raise AssertionError('campaign data left in storage after sign-out: ' + str(hits) + ' ' + json.dumps({k: j[k] for k in hits})[:600])

            # ---------- GM: hide an NPC, hand Kira to Lee ----------
            await gm.evaluate("() => { const S = Object.values(DB.settings)[0]; DB.ui.settingId = S.id; DB.ui.tab = 'chars'; A.newChar(); const c = curC(); c.name = 'Azula'; touch(c); render(); }")
            azula = await gm.evaluate("curC().id")
            await until(p1, f"!!DB.chars['{azula}']", 'p1 sees Azula')
            await gm.evaluate(f"A.netHide({{ dataset: {{ id: '{azula}', v: '1' }} }})")
            await until(p1, f"!DB.chars['{azula}']", 'Azula hidden from p1')
            await until(p2, f"!DB.chars['{azula}']", 'Azula hidden from p2')
            lee = await p2.evaluate("netUid()")
            await gm.evaluate(f"() => {{ const c = DB.chars['{kira}']; c.owner = '{lee}'; c.ownerName = 'Lee'; touch(c); }}")
            await until(p2, f"netCanWrite(DB.chars['{kira}'])", 'Lee can edit Kira')
            await until(p1, f"netReadOnly(DB.chars['{kira}'])", 'Sam now read-only on Kira')

            # ---------- joining closed, new code, removal ----------
            await gm.evaluate(f"tableRef('{tid}').update({{ open: false }})")
            p3 = await mkpage(b, 'p3', port)
            await p3.goto(PLAY_URL + '#code=' + code)
            await signup(p3, 'Toph', 'toph@example.com', 'metalbend')
            await until(p3, "document.body.innerText.includes('closed this campaign')", 'p3 sees closed note')
            await p3.click('[data-act="netJoinGo"]'); await p3.wait_for_timeout(600)
            assert await p3.evaluate("Object.keys(DB.net.tables).length") == 0
            await gm.evaluate(f"netNewCode('{tid}')")
            await until(gm, f"NET.meta['{tid}'].code && NET.meta['{tid}'].code !== '{code}'", 'new code')
            await p3.evaluate(f"DB.net.codeDraft = '{code}'; NET.joining = null; render()")
            await p3.click('[data-act="netCodeGo"]')
            await until(p3, "[...document.querySelectorAll('#toasts > *')].some(t => /No campaign has that room code/.test(t.textContent))", 'old code refused')
            await p3.context.close()
            await gm.evaluate(f"tableRef('{tid}').collection('members').doc('{samUid}').delete()")
            await until(p1, f"DB.net.tables['{tid}'].gone === 'removed'", 'Sam removed')

            # ---------- GM reload keeps the session; then closes the campaign ----------
            before = await gm.evaluate("[(localStorage.getItem('primeforge.v1')||'').length, Object.keys(DB.settings).length, !!localStorage.getItem('fakefb.auth'), location.href.slice(-40)]")
            await gm.reload()
            await gm.wait_for_timeout(400)
            after = await gm.evaluate("[(localStorage.getItem('primeforge.v1')||'').length, Object.keys(DB.settings).length, !!localStorage.getItem('fakefb.auth'), location.href.slice(-40)]")
            print('reload', before, after)
            await until(gm, "NET.status === 'online' && Object.keys(NET.subs).length === 1", 'GM back online after reload')
            await gm.evaluate("DB.ui.tab = 'online'; render()"); await gm.wait_for_timeout(200)
            await gm.screenshot(path=str(OUT / '07-gm-online-after.png'), full_page=True)
            await gm.evaluate(f"netClose('{tid}')")
            await until(p2, f"DB.net.tables['{tid}'].gone === 'closed'", 'Lee sees closed')
            left = [k for k in dump() if k.startswith('tables/') or k.startswith('codes/')]
            assert not left, left
            assert await gm.evaluate("Object.values(DB.chars).filter(c => c.table).length") == 0
            assert await gm.evaluate("Object.values(DB.chars).some(c => c.name === 'Kira')"), 'GM keeps copies'
            await p2.evaluate("DB.ui.tab = 'home'; render()"); await p2.wait_for_timeout(200)
            await p2.screenshot(path=str(OUT / '08-p2-closed.png'), full_page=True)
            await b.close()
    finally:
        srv.kill(); web.kill()
    bad = [x for x in problems if 'favicon' not in x]
    print('\n'.join(bad) if bad else 'no errors')

asyncio.run(main())
