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
            await pg.goto(f'http://127.0.0.1:{port}/#/'); await pg.wait_for_timeout(500)
            await pg.evaluate("DB.ui.tab='online'; render()"); await pg.wait_for_timeout(300)
            assert await pg.evaluate("netSiteCfg()"), 'site config not picked up'
            assert await pg.locator('#netCfgTxt').count() == 0, 'setup panel shown despite site config'
            await pg.click('[data-act="netConnect"]')
            await pg.wait_for_function("NET.status === 'error' || NET.status === 'online'", timeout=30000)
            st = await pg.evaluate("[NET.status, NET.err, typeof firebase, firebase.SDK_VERSION]")
            print('status', st)
            assert st[2] == 'object' and st[3] == '10.12.2', st
            assert any(u.startswith('vendor/firebase-auth-compat.js') for u in loaded), loaded
            # objects the sync layer uses exist with the expected shape
            shape = await pg.evaluate("""() => { const db = firebase.firestore(); const r = db.collection('tables').doc('x');
              const q = r.collection('chars').where('hidden','==',false); const q2 = r.collection('rolls').orderBy('at','desc').limit(30);
              return [typeof r.onSnapshot, typeof q.onSnapshot, typeof q2.onSnapshot, typeof r.set, typeof r.update, typeof firebase.firestore.FieldValue.delete, typeof firebase.auth.GoogleAuthProvider, typeof firebase.auth().signInAnonymously]; }""")
            print('shape', shape); assert all(s == 'function' for s in shape), shape
            await pg.screenshot(path=str(OUT / 'online-error.png'), full_page=True)
            await b.close()
    finally:
        srv.kill()
    print('\n'.join(errs) if errs else 'no errors')
asyncio.run(main())
