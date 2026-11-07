# Online tables: GM + two players in separate browsers, against the fake Firebase in test/fake.
import asyncio, subprocess, os, re
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist' / 'prime-forge.html').as_uri()
OUT = ROOT / 'test' / 'out' / 't5'; OUT.mkdir(parents=True, exist_ok=True)
FAKE = (ROOT / 'test' / 'fake' / 'fake-firebase.js').read_text(encoding='utf-8')
CFG = 'const firebaseConfig = {\n  apiKey: "AIzaFakeKey123",\n  authDomain: "demo-forge.firebaseapp.com",\n  projectId: "demo-forge",\n  storageBucket: "demo-forge.appspot.com",\n  messagingSenderId: "1",\n  appId: "1:1:web:abc"\n};'
problems = []

async def mkpage(browser, name, port, google=None):
    ctx = await browser.new_context(viewport={'width': 1280, 'height': 900})
    init = f"window.FAKE_FB_URL='http://127.0.0.1:{port}';" + (f"window.FAKE_GOOGLE_EMAIL='{google}';" if google else '') + FAKE
    await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: problems.append(f'{name} pageerror: {e}'))
    pg.on('console', lambda m: problems.append(f'{name} console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    return pg

async def until(pg, js, what, timeout=8000):
    try: await pg.wait_for_function(js, timeout=timeout)
    except Exception:
        info = await pg.evaluate("JSON.stringify({status: NET.status, err: NET.err, tables: DB.net.tables, subs: Object.keys(NET.subs), chars: Object.values(DB.chars).map(c => [c.name, c.table, c.owner]), tab: DB.ui.tab})")
        raise AssertionError('timed out waiting for: ' + what + '\n' + info)

async def main():
    srv = subprocess.Popen(['node', str(ROOT / 'test' / 'fake' / 'server.js')], stdout=subprocess.PIPE, text=True)
    port = int(re.search(r'PORT (\d+)', srv.stdout.readline()).group(1))
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            gm = await mkpage(b, 'gm', port, google='nixxen@example.com')
            await gm.goto(URL); await gm.wait_for_timeout(300)
            await gm.evaluate("""() => { const s = newSetting('Ashes of the Earth Kingdom'); s.tagline = 'The Avatar is gone.';
              const a = newSet('attributes'); a.traits = ['Body','Mind','Spirit'].map(n => newTrait(n)); s.sets.push(a);
              DB.settings[s.id] = s; const c = newChar(s); c.name = 'Old Iroh'; DB.chars[c.id] = c; DB.ui.settingId = s.id; DB.ui.tab = 'online'; save(); render(); }""")
            # setup panel: paste config, point invite links at the local file
            await gm.fill('#netCfgTxt', CFG)
            await gm.fill('[data-bind="N.site"]', URL)
            await gm.click('[data-act="netSaveCfg"]')
            await until(gm, "NET.status === 'online'", 'GM online')
            await gm.screenshot(path=str(OUT / '01-gm-online.png'), full_page=True)
            await gm.fill('[data-bind="N.name"]', 'Nixxen')
            await gm.click('[data-act="netCreate"]'); await gm.click('#cfYes')
            await until(gm, "Object.keys(DB.net.tables).length === 1 && !!document.querySelector('.netinv')", 'table opened')
            invite = await gm.input_value('.netinv')
            assert '#join=' in invite and '&cfg=' in invite and invite.startswith(URL), invite
            tid = await gm.evaluate("Object.keys(DB.net.tables)[0]")
            await until(gm, f"(NET.members['{tid}']||[]).length === 1", 'GM is a member')
            await until(gm, "Object.values(DB.chars).some(c => c.name === 'Old Iroh' && c.table)", 'GM char brought')
            await gm.screenshot(path=str(OUT / '02-gm-table.png'), full_page=True)

            # player 1 joins from the link
            p1 = await mkpage(b, 'p1', port)
            await p1.goto(invite)
            await until(p1, "!!document.querySelector('#netJoinName')", 'p1 sees invite card')
            await p1.screenshot(path=str(OUT / '03-p1-invite.png'), full_page=True)
            await p1.fill('#netJoinName', 'Sam'); await p1.click('[data-act="netJoinGo"]')
            await until(p1, "DB.ui.tab === 'chars' && curS() && curS().name === 'Ashes of the Earth Kingdom' && isLocked(curS())", 'p1 has locked setting')
            tabs = await p1.evaluate("tabsFor().map(t => t.label)")
            assert 'Designer' not in tabs, tabs
            await until(p1, "Object.values(DB.chars).some(c => c.name === 'Old Iroh')", 'p1 sees GM char')
            await p1.click('[data-act="newChar"]')
            await p1.fill('[data-bind="C.name"]', 'Kira'); await p1.wait_for_timeout(100)
            await p1.click('h1')  # blur
            p1uid = await p1.evaluate("netUid()")
            await until(gm, f"Object.values(DB.chars).some(c => c.name === 'Kira' && c.owner === '{p1uid}' && c.ownerName === 'Sam')", 'GM sees Kira')
            kira = await gm.evaluate("Object.values(DB.chars).find(c => c.name === 'Kira').id")
            await until(gm, f"(NET.members['{tid}']||[]).length === 2", 'GM sees 2 members')

            # GM changes the setting; player sees it live
            await gm.evaluate("() => { const S = Object.values(DB.settings)[0]; S.tagline = 'Ba Sing Se must be warned.'; touch(S); }")
            await until(p1, "curS().tagline === 'Ba Sing Se must be warned.'", 'p1 gets setting update')

            # player rolls; GM sees it in the table feed
            await p1.evaluate("DB.ui.tab = 'dice'; render()")
            await p1.click('[data-act="poolAddDie"][data-die="8"]'); await p1.click('[data-act="poolAddDie"][data-die="6"]')
            await p1.click('[data-act="rollPool"]')
            await until(gm, f"(NET.rolls['{tid}']||[]).some(r => r.name === 'Sam' && /rolled/.test(r.text))", 'GM sees roll')
            await gm.evaluate("DB.ui.tab = 'dice'; render()"); await gm.wait_for_timeout(200)
            assert await gm.locator('text=Table rolls').count() == 1
            await gm.screenshot(path=str(OUT / '04-gm-rolls.png'), full_page=True)

            # player 2 joins, can see Kira but not change her
            p2 = await mkpage(b, 'p2', port, google='lee@example.com')
            await p2.goto(invite)
            await until(p2, "!!document.querySelector('#netJoinName')", 'p2 sees invite')
            await p2.fill('#netJoinName', 'Lee'); await p2.click('[data-act="netJoinGo"]')
            await until(p2, f"!!DB.chars['{kira}']", 'p2 sees Kira')
            assert await p2.evaluate(f"netReadOnly(DB.chars['{kira}'])")
            await p2.evaluate(f"DB.ui.charId = '{kira}'; DB.ui.cview = 'build'; render()")
            await until(p2, "document.body.innerText.includes('belongs to Sam')", 'read-only banner')
            await p2.screenshot(path=str(OUT / '05-p2-readonly.png'), full_page=True)
            pp_before = await p2.evaluate(f"DB.chars['{kira}'].pp")
            btn = p2.locator('[data-act="ppBump"][data-n="1"]')
            if await btn.count(): await btn.first.click()
            assert await p2.evaluate(f"DB.chars['{kira}'].pp") == pp_before, 'read-only char changed'
            denied = await p2.evaluate(f"""async () => {{ try {{ await tableRef('{tid}').collection('chars').doc('{kira}').set({{ owner: netUid(), ownerName: 'Lee', name: 'Stolen', hidden: false, json: '{{}}', updated: '', by: netUid(), at: 1 }}); return 'allowed'; }} catch (e) {{ return e.code; }} }}""")
            assert denied == 'permission-denied', denied
            dice_chars = await p2.evaluate("charsOf(curS()).filter(netCanWrite).map(c => c.name)")
            assert 'Kira' not in dice_chars

            # GM hides an NPC: players lose it; showing it brings it back
            await gm.evaluate("() => { const S = Object.values(DB.settings)[0]; DB.ui.settingId = S.id; DB.ui.tab = 'chars'; A.newChar(); const c = curC(); c.name = 'Azula'; touch(c); render(); }")
            azula = await gm.evaluate("curC().id")
            await until(p1, f"!!DB.chars['{azula}']", 'p1 sees Azula')
            await gm.evaluate(f"A.netHide({{ dataset: {{ id: '{azula}', v: '1' }} }})")
            await until(p1, f"!DB.chars['{azula}']", 'Azula hidden from p1')
            await until(p2, f"!DB.chars['{azula}']", 'Azula hidden from p2')
            await gm.evaluate(f"A.netHide({{ dataset: {{ id: '{azula}', v: '0' }} }})")
            await until(p2, f"!!DB.chars['{azula}']", 'Azula back for p2')

            # GM hands Kira to Lee; Lee can now edit, and everyone sees it
            lee = await p2.evaluate("netUid()")
            await gm.evaluate(f"() => {{ const c = DB.chars['{kira}']; c.owner = '{lee}'; c.ownerName = 'Lee'; touch(c); }}")
            await until(p2, f"netCanWrite(DB.chars['{kira}'])", 'Lee can edit Kira')
            await p2.evaluate(f"() => {{ const c = DB.chars['{kira}']; c.concept = 'Earthbender smuggler'; touch(c); }}")
            await until(gm, f"DB.chars['{kira}'].concept === 'Earthbender smuggler'", 'GM sees Lee edit')
            await until(p1, f"DB.chars['{kira}'].concept === 'Earthbender smuggler' && netReadOnly(DB.chars['{kira}'])", 'Sam sees edit, read-only now')

            # Lee links Google, reloads, keeps everything
            await p2.evaluate("DB.ui.tab = 'online'; render()")
            await p2.click('[data-act="netLinkGoogle"]')
            await until(p2, "netGoogleEmail() === 'lee@example.com'", 'Lee linked Google')
            await p2.reload(); await until(p2, "NET.status === 'online' && Object.keys(NET.subs).length === 1", 'Lee back online after reload')
            await until(p2, f"netCanWrite(DB.chars['{kira}'])", 'Lee still owns Kira after reload')
            await p2.screenshot(path=str(OUT / '06-p2-online-tab.png'), full_page=True)

            # GM closes joining: a newcomer is refused
            await gm.evaluate(f"tableRef('{tid}').update({{ open: false }})")
            p3 = await mkpage(b, 'p3', port)
            await p3.goto(invite)
            await until(p3, "!!document.querySelector('#netJoinName') && document.body.innerText.includes('closed this table')", 'p3 sees closed note')
            await p3.fill('#netJoinName', 'Toph'); await p3.click('[data-act="netJoinGo"]'); await p3.wait_for_timeout(600)
            assert await p3.evaluate("Object.keys(DB.net.tables).length") == 0
            await p3.context.close()

            # GM removes Sam
            await gm.evaluate(f"tableRef('{tid}').collection('members').doc('{p1uid}').delete()")
            await until(p1, f"DB.net.tables['{tid}'].gone === 'removed'", 'Sam removed')
            assert await p1.evaluate("Object.values(DB.settings).length") == 1  # keeps a copy

            # Lee on a new device: Google sign-in brings the table back
            p2b = await mkpage(b, 'p2b', port, google='lee@example.com')
            await p2b.goto(URL)
            await p2b.evaluate(f"DB.net.cfg = {{ apiKey: 'AIzaFakeKey123', projectId: 'demo-forge', authDomain: 'demo-forge.firebaseapp.com', appId: '1:1:web:abc' }}; DB.ui.tab='online'; save(); render()")
            await p2b.click('[data-act="netConnect"]')
            await until(p2b, "NET.status === 'online'", 'new device online')
            await p2b.click('[data-act="netGoogleSignIn"]')
            await until(p2b, f"!!DB.net.tables['{tid}'] && !!DB.chars['{kira}'] && netCanWrite(DB.chars['{kira}'])", 'tables restored on new device')

            # GM closes the table
            await gm.evaluate(f"netClose('{tid}')")
            await until(p2, f"DB.net.tables['{tid}'].gone === 'closed'", 'Lee sees closed')
            assert await gm.evaluate("Object.keys(DB.net.tables).length") == 0
            assert await gm.evaluate("Object.values(DB.chars).filter(c => c.table).length") == 0
            dump = subprocess.run(['node', '-e', f"fetch('http://127.0.0.1:{port}/op',{{method:'POST',body:JSON.stringify({{op:'dump'}})}}).then(r=>r.json()).then(j=>console.log(Object.keys(j.docs).filter(k=>k.startsWith('tables/')).length))"], capture_output=True, text=True).stdout.strip()
            assert dump == '0', 'table docs left: ' + dump

            # mobile look of the online tab
            await gm.set_viewport_size({'width': 390, 'height': 844})
            await gm.evaluate("DB.ui.tab = 'online'; render()"); await gm.wait_for_timeout(200)
            sw = await gm.evaluate("document.documentElement.scrollWidth")
            assert sw <= 390, f'horizontal scroll {sw}'
            await gm.screenshot(path=str(OUT / '07-gm-mobile.png'), full_page=True)
            await b.close()
    finally:
        srv.kill()
    bad = [x for x in problems if 'favicon' not in x]
    print('\n'.join(bad) if bad else 'no errors')

asyncio.run(main())
