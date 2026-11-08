# Real Firebase SDK smoke test: the site served over http loads firebase-config.js and vendor/ SDK files,
# initializes, and reports a clean error when Firebase can't be reached (no network in tests).
import asyncio, subprocess, socket, pathlib
from playwright.async_api import async_playwright
SITE = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = pathlib.Path(__file__).resolve().parent / 'out' / 't6'; OUT.mkdir(parents=True, exist_ok=True)
def free():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
async def main():
    port = free()
    srv = subprocess.Popen(['python3', '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(0.8)
    errs = []; loaded = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('request', lambda r: loaded.append(r.url.replace(f'http://127.0.0.1:{port}/', '')))
            async def cfg(route):
                await route.fulfill(content_type='text/javascript', body='window.PF_FIREBASE = { apiKey: "AIzaSyFakeKeyForTests000000000000000", authDomain: "demo-forge.firebaseapp.com", projectId: "demo-forge", appId: "1:1:web:abc" };')
            await pg.route('**/firebase-config.js', cfg)
            await pg.goto(f'http://127.0.0.1:{port}/'); await pg.wait_for_timeout(500)
            await pg.evaluate("DB.ui.tab='online'; render()"); await pg.wait_for_timeout(300)
            assert await pg.evaluate("netSiteCfg()"), 'site config not picked up'
            assert await pg.locator('#netCfgTxt').count() == 0, 'setup panel shown despite site config'
            await pg.wait_for_function("['signedout', 'error', 'online'].includes(NET.status)", timeout=30000)
            st = await pg.evaluate("[NET.status, NET.err, typeof firebase, firebase.SDK_VERSION]")
            print('gm status', st)
            assert st[0] == 'signedout', st
            # email sign-in reaches the real SDK and fails cleanly without network
            await pg.fill('[data-bind="N.email"]', 'gm@example.com'); await pg.fill('#netPw', 'secret123')
            await pg.click('[data-act="netEmailGo"]')
            await pg.wait_for_function("!NET.busy", timeout=30000)
            toasts = await pg.evaluate("[...document.querySelectorAll('#toasts > *')].map(t => t.textContent)")
            print('gm sign-in toast', toasts)
            assert any('connection' in t.lower() or 'network' in t.lower() for t in toasts), toasts
            assert st[2] == 'object' and st[3] == '10.12.2', st
            assert any(u.startswith('vendor/firebase-auth-compat.js') for u in loaded), loaded
            # objects the sync layer uses exist with the expected shape
            shape = await pg.evaluate("""() => { const db = firebase.firestore(); const r = db.collection('tables').doc('x');
              const q = r.collection('chars').where('hidden','==',false); const q2 = r.collection('rolls').orderBy('at','desc').limit(30);
              return [typeof r.onSnapshot, typeof q.onSnapshot, typeof q2.onSnapshot, typeof r.set, typeof r.update, typeof firebase.firestore.FieldValue.delete, typeof firebase.auth.GoogleAuthProvider, typeof firebase.auth().signInAnonymously]; }""")
            print('shape', shape); assert all(s == 'function' for s in shape), shape
            await pg.screenshot(path=str(OUT / 'gm-signin.png'), full_page=True)
            # the player app under play/ finds ../firebase-config.js and ../vendor/
            pp = await b.new_page(); loaded.clear()
            pp.on('pageerror', lambda e: errs.append('play: ' + str(e)))
            pp.on('request', lambda r: loaded.append(r.url.replace(f'http://127.0.0.1:{port}/', '')))
            await pp.route('**/firebase-config.js', cfg)
            await pp.goto(f'http://127.0.0.1:{port}/play/#code=abc-def')
            await pp.wait_for_function("NET.status === 'signedout'", timeout=30000)
            assert 'firebase-config.js' in loaded and any(u == 'vendor/firebase-firestore-compat.js' for u in loaded), loaded
            assert await pp.evaluate("NET.pendingCode") == 'ABCDEF'
            assert await pp.locator('[data-act="netGoogle"]').count() == 1
            assert await pp.evaluate("document.title") == 'Prime Forge Players'
            await pp.screenshot(path=str(OUT / 'play-signin.png'), full_page=True)
            await b.close()
    finally:
        srv.kill()
    print('\n'.join(errs) if errs else 'no errors')
asyncio.run(main())
