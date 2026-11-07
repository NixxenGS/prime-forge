import asyncio
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
import os as _os
OUT=str(ROOT/'test'/'out'/'t3'); _os.makedirs(OUT, exist_ok=True)
URL=(ROOT/'dist/prime-forge.html').as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        m = await b.new_page(viewport={'width':390,'height':844})
        await m.goto(URL)
        await m.evaluate("""(()=>{localStorage.clear(); loadDB(); const S=newSetting('Mobile'); const at=newSet('attributes'); at.traits=['A','B','C'].map(n=>newTrait(n)); S.sets.push(at); DB.settings[S.id]=S; DB.ui.settingId=S.id; const c=newChar(S); c.name='M'; DB.chars[c.id]=c; DB.ui.charId=c.id; DB.ui.tab='chars'; DB.ui.cview='build'; render();})()""")
        await m.wait_for_timeout(200)
        h = await m.evaluate("document.querySelector('.appbar').getBoundingClientRect().height")
        await m.evaluate("window.scrollTo(0, 900)"); await m.wait_for_timeout(200)
        await m.screenshot(path=f'{OUT}/mob-build-scrolled.png')
        m2 = await b.new_page(viewport={'width':900,'height':800})
        await m2.goto(URL); await m2.wait_for_timeout(200)
        await m2.evaluate("DB.ui.tab='chars'; DB.ui.cview='build'; render(); window.scrollTo(0,600)"); await m2.wait_for_timeout(200)
        h2 = await m2.evaluate("document.querySelector('.appbar').getBoundingClientRect().height")
        await m2.screenshot(path=f'{OUT}/tab-build-scrolled.png')
        print('appbar heights', h, h2)
        await b.close()
asyncio.run(main())
