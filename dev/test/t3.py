import asyncio, json, os
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
OUT=str(ROOT/'test'/'out'/'t3'); os.makedirs(OUT, exist_ok=True)
URL=(ROOT/'dist/prime-forge.html').as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1360,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.type+': '+m.text) if m.type in ('error','warning') else None)
        await pg.goto(URL); await pg.wait_for_timeout(300)
        r = await pg.evaluate(r"""(() => {
          localStorage.clear(); loadDB();
          const S = newSetting('Edge Cases'); DB.settings[S.id]=S; DB.ui.settingId=S.id;
          const at = newSet('attributes'); at.traits=['Grit','Wits','Charm'].map(n=>newTrait(n));
          const sk = newSet('skills'); sk.traits=['Fight','Sneak','Know','Talk'].map(n=>newTrait(n)); sk.specialties=true; sk.freeSpec=sk.traits[2].id; sk.pyramid=true;
          S.sets.push(at, sk); S.spec.multiLevel=true; S.dist.rated='variable'; S.dist.highlightSet=sk.id;
          S.mods.stress=true; S.opt.shaken=true; S.stress.shakenSet=at.id;
          S.mods.staticDiff=true; S.mods.heroDice=true; S.opt.heroAsPP=true;
          const c = newChar(S); c.name='Tess'; DB.chars[c.id]=c; DB.ui.charId=c.id;
          const ds = distSet(S); c.entries[ds.id][0]=Object.assign(newDistinction('Brawler'),{die:10,hl:[sk.traits[0].id, sk.traits[0].id]}); c.entries[ds.id][1]=Object.assign(newDistinction('Bookish'),{die:6}); c.entries[ds.id][2]=Object.assign(newDistinction('Lucky'),{die:8});
          c.ratings[sk.id][sk.traits[0].id]=10; c.ratings[sk.id][sk.traits[2].id]=8; c.ratings[sk.id][sk.traits[1].id]=6;
          c.specs.push({id:'sp1',setId:sk.id,traitId:sk.traits[2].id,name:'History',die:8,count:1},{id:'sp2',setId:sk.id,traitId:sk.traits[1].id,name:'Locks',die:6,count:2});
          c.stress['t:'+at.traits[0].id]=10; c.hero=[6,10];
          save();
          return JSON.stringify(budget(S,c).groups.map(g=>[g.title,g.rows.map(r=>r.label+':'+r.have+'/'+r.need+':'+r.state),g.warns]));
        })()""")
        print('BUDGET', r)
        await pg.evaluate("DB.ui.tab='chars'; DB.ui.cview='build'; render()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/build.png', full_page=True)
        await pg.evaluate("DB.ui.cview='file'; render()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/file.png', full_page=True)
        # static difficulty roll
        await pg.click('.ftrait .nmb>>nth=0'); await pg.click('.ftrait .nmb>>nth=3'); await pg.click('[data-act="poolSpec"]>>nth=0')
        await pg.evaluate("DB.ui.tab='dice'; render()")
        await pg.click('[data-act="setStatic"][data-v="11"]')
        await pg.click('[data-act="rollPool"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="spendHero"]>>nth=0'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/dice-static.png', full_page=True)
        # addAll + rerollEffect
        await pg.evaluate("(()=>{const S=curS(); S.mods.addAll=true; S.mods.rerollEffect=true; render();})()")
        await pg.click('[data-act="rollPool"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-act="rerollEffect"]'); await pg.wait_for_timeout(100)
        await pg.screenshot(path=f'{OUT}/dice-addall.png', full_page=True)
        await pg.evaluate("(()=>{const S=curS(); S.mods.addAll=false; S.mods.rerollEffect=false; S.mods.noEffect=true; render();})()")
        await pg.click('[data-act="rollPool"]'); await pg.wait_for_timeout(100)
        await pg.screenshot(path=f'{OUT}/dice-noeffect.png', full_page=True)
        # resolve statement flow
        await pg.evaluate("""(()=>{const S=curS(),C=curC(); const at=S.sets.find(x=>x.flavor==='attributes'); at.statements=true; C.stmt[at.id]={[at.traits[1].id]:{text:'I trust no one'}}; DB.ui.tab='chars'; DB.ui.cview='file'; render();})()""")
        await pg.click('[data-act="challenge"]'); await pg.click('[data-act="rollFromTray"]'); await pg.wait_for_timeout(100)
        await pg.evaluate("DB.ui.tab='chars'; render()")
        await pg.click('[data-act="resolveStmt"]'); await pg.fill('#rsTxt', 'I trust my crew'); await pg.click('#rsNew'); await pg.wait_for_timeout(100)
        st = await pg.evaluate("(()=>{const S=curS(),C=curC(); const at=S.sets.find(x=>x.flavor==='attributes'); return JSON.stringify([C.stmt[at.id], C.ratings[at.id][at.traits[1].id]])})()")
        print('resolved', st)
        # backup export/import roundtrip
        txt = await pg.evaluate("envelope('backup',{settings:DB.settings,chars:DB.chars,gm:DB.gm})")
        await pg.evaluate("localStorage.clear(); loadDB(); render();")
        await pg.evaluate("t=>importText(t)", txt); await pg.wait_for_timeout(100); await pg.click('#cfYes'); await pg.wait_for_timeout(200)
        n = await pg.evaluate("[Object.keys(DB.settings).length, Object.keys(DB.chars).length]")
        print('after backup import', n)
        # reload persistence
        await pg.wait_for_timeout(400)
        await pg.reload(); await pg.wait_for_timeout(300)
        n2 = await pg.evaluate("[Object.keys(DB.settings).length, Object.keys(DB.chars).length, DB.ui.tab]")
        print('after reload', n2)
        # visit every tab after reload in dark
        await pg.evaluate("DB.ui.theme='dark'")
        for t in ['vault','designer','chars','dice','gm','rules']:
            await pg.evaluate(f"DB.ui.tab='{t}'; render()"); await pg.wait_for_timeout(100)
        await pg.evaluate("DB.ui.tab='dice'; render()"); await pg.screenshot(path=f'{OUT}/dice-dark.png', full_page=True)
        await pg.evaluate("DB.ui.tab='vault'; render()"); await pg.screenshot(path=f'{OUT}/vault-dark.png', full_page=True)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
