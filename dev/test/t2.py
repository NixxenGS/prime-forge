import asyncio, json
from playwright.async_api import async_playwright
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parent.parent
OUT=str(ROOT/'test'/'out'/'t2')
import os; os.makedirs(OUT, exist_ok=True)
URL=(ROOT/'dist/prime-forge.html').as_uri()
SETUP = r"""
(() => {
  localStorage.clear(); loadDB();
  const S = newSetting('Hollow Stars'); S.tagline = 'Salvage crews at the edge of a dead empire';
  S.pitch = 'You crew a patched-up salvage ship picking over the wrecks of a fallen star empire.';
  DB.settings[S.id] = S; DB.ui.settingId = S.id;
  const at = newSet('attributes'); at.traits = ['Body','Mind','Nerve'].map(n=>newTrait(n)); at.statements = true;
  const ro = newSet('roles'); ro.traits = ['Pilot','Gunner','Tech','Face','Medic'].map(n=>newTrait(n)); ro.specialties = true; ro.freeSpec = ro.traits[2].id;
  const va = newSet('values'); va.traits = ['Duty','Glory','Love','Truth'].map(n=>newTrait(n)); va.prime=false;
  const rel = newSet('relationships');
  const sig = newSet('sigassets');
  const res = newSet('resources');
  const ps = newSet('powersets');
  const ab = newSet('abilities');
  const ta = newSet('talents');
  const co = newSet('customOpen'); co.name = 'Scars';
  S.sets.push(at, ro, va, rel, sig, res, ps, ab, ta, co);
  S.dist.highlightSet = ro.id;
  S.dist.library.push({id:uid('l_'), name:'Ex-Navy Ace', desc:'You flew for the old fleet.', hl:[ro.traits[0].id, ro.traits[1].id], sfx:[{id:uid('x_'),name:'Hot Hands',text:'Spend a PP to double PILOT when outnumbered.'}]});
  S.lib.powersets.push({id:uid('l_'), name:'Void-Touched', desc:'The dark between stars got into you.', powers:[{id:uid('p_'),name:'Sense the Void',die:8},{id:uid('p_'),name:'Cold Grip',die:8}], sfx:[{id:uid('x_'),name:'Whisper',text:'Spend a PP to ask the void one question.'},{id:uid('x_'),name:'Chill',text:'Add a d6 when you fight in vacuum.'}], limits:[{id:uid('x_'),name:'Drained',text:'Shut down Void-Touched to gain a PP; recover after rest.'}]});
  S.lib.abilities.push({id:uid('l_'), name:'Blink', die:8, effect:'Movement', descriptor:'Short teleport', desc:'', sfx:[{id:uid('x_'),name:'Skip',text:'Spend a PP to blink past a barrier.'},{id:uid('x_'),name:'Rescue',text:'Blink an ally out of danger.'}]});
  S.lib.talents.push({id:uid('l_'), name:'Deck Hand', group:'Spacer', desc:'', activation:'You are aboard your own ship.', effect:'Step up TECH for repairs.'});
  S.lib.archetypes.push({id:uid('a_'), name:'The Wildcat Pilot', pitch:'Fast, reckless, beloved.', ratings:{[at.id]:{[at.traits[0].id]:8,[at.traits[1].id]:6,[at.traits[2].id]:10}}, dists:[{name:'Ex-Navy Ace',desc:'',hl:[ro.traits[0].id],sfx:[{name:'Barrel Roll',text:'Spend a PP to reroll when dodging.'}]},{name:'Owes Everyone Money',desc:'',hl:[],sfx:[]},{name:'Sings to the Engines',desc:'',hl:[],sfx:[]}], sig:[{name:'Lucky Dice',die:8},{name:'Grandpa\'s Revolver',die:8}], notes:''});
  Object.keys(S.mods).forEach(k => S.mods[k] = true); S.mods.addAll=false; S.mods.noEffect=false; S.mods.rerollEffect=false; S.mods.staticDiff=false; S.mods.actionBased=false;
  S.opt.trauma = true; S.opt.pushStress = true; S.opt.lifeMode='threshold'; S.opt.turnMode='initiative';
  S.stress.tracks = [{id:uid('st_'),name:'Hurt'},{id:uid('st_'),name:'Shaken'}];
  S.life.a = at.id+':'+at.traits[0].id; S.life.best=[ro.id+':'+ro.traits[4].id];
  S.creation.methods = {scratch:true, archetypes:true, pathways:true};
  S.creation.stages = PATHWAY_TABLE.slice(0,5).map((x,i)=>Object.assign(clone(x),{g:clone(PATHWAY_GRANTS5[i])}));
  S.vehicle.traits = [{name:'Engines'},{name:'Frame'},{name:'Systems'}];
  S.lib.sfx.push({id:uid('x_'), name:'Second Wind', text:'Spend a PP to step down Hurt.'});
  save(); render();
  return S.id;
})()
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1360,'height':900}, accept_downloads=True)
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.type+': '+m.text) if m.type in ('error','warning') else None)
        await pg.goto(URL); await pg.wait_for_timeout(500)
        sid = await pg.evaluate(SETUP)
        await pg.click('button.tab[data-tab="designer"]')
        secs = await pg.eval_on_selector_all('.sidenav button[data-id]', 'bs=>bs.map(b=>b.dataset.id)')
        for s in secs:
            await pg.click(f'.sidenav button[data-id="{s}"]'); await pg.wait_for_timeout(120)
            if s in ('lib_archetypes','creation','mods_harm','review','lib_powersets','distinctions'):
                await pg.screenshot(path=f'{OUT}/d-{s}.png', full_page=True)
        print('designer sections:', secs)
        # character via archetype
        await pg.click('button.tab[data-tab="chars"]'); await pg.click('text=New character'); await pg.wait_for_timeout(200)
        await pg.fill('input[data-bind="C.name"]', 'Juno Okafor'); await pg.wait_for_timeout(500)
        await pg.click('button[data-m="archetype"]'); await pg.click('#cfYes'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="applyArch"]'); await pg.click('#cfYes'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="archSig"]>>nth=0'); await pg.wait_for_timeout(200)
        # roles assign
        await pg.evaluate("""(()=>{const S=curS(),C=curC(); const ro=S.sets.find(x=>x.flavor==='roles'); const arr=[10,8,6,6,4]; ro.traits.forEach((t,i)=>C.ratings[ro.id][t.id]=arr[i]); 
          const rel=S.sets.find(x=>x.flavor==='relationships'); C.entries[rel.id]=[Object.assign(newEntry(rel),{name:'Captain Ilse',die:10,statement:'She saved my life'}),Object.assign(newEntry(rel),{name:'Brother Tam',die:8}),Object.assign(newEntry(rel),{name:'The Broker',die:6})];
          const res=S.sets.find(x=>x.kind==='resources'); C.entries[res.id]=[Object.assign(newEntry(res),{name:'Dockside Crew',type:'extra',tags:['Labor','Rumors']})];
          const ps=S.sets.find(x=>x.kind==='powersets'); const lib=clone(S.lib.powersets[0]); lib.id=uid('e_'); C.entries[ps.id]=[lib];
          const ta=S.sets.find(x=>x.kind==='talents'); C.entries[ta.id]=[Object.assign(newEntry(ta),{name:'Deck Hand',activation:'Aboard',effect:'Step up TECH'})];
          C.specs.push({id:uid('sp_'),setId:ro.id,traitId:ro.traits[2].id,name:'Reactors',die:6,count:1});
          C.stmt[S.sets.find(x=>x.flavor==='attributes').id]={};
          const at=S.sets.find(x=>x.flavor==='attributes'); C.stmt[at.id][at.traits[2].id]={text:'Nothing scares me'};
          C.stress[S.stress.tracks[0].id]=6; C.hero=[8]; C.sessions=[{id:'s1',name:'The Drowned Cruiser',callback:false,spent:false}]; C.xp.earned=7;
          C.milestones[0]={name:'Salvage Rights',desc:'',x1:'when you claim loot',x3:'when you outbid a rival',x10:'when you strip a capital ship'};
          C.vehicles=[{id:'v1',name:'Rustbucket',scale:8,r:{0:10,1:6,2:8},dist:'Held Together With Tape',sig:'',sfx:[]}];
          C.temps=[{id:'t1',name:'Cover',die:6,type:'asset',scope:'scene'},{id:'t2',name:'Bleeding',die:4,type:'comp',scope:'open'}];
          touch(C); render();})()""")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/b-builder.png', full_page=True)
        await pg.click('.seg button[data-v="file"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/f-file-light.png', full_page=True)
        # challenge + hinder + resource roll
        await pg.click('[data-act="challenge"]'); await pg.click('[data-act="poolHinder"]>>nth=0'); await pg.click('[data-act="poolRes"]>>nth=0')
        await pg.click('[data-act="poolEntry"]>>nth=0'); await pg.click('[data-act="poolEntry"]>>nth=1')
        await pg.wait_for_timeout(200)
        await pg.click('[data-act="rollFromTray"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/r-roll.png', full_page=True)
        info = await pg.evaluate("(()=>{const C=curC(); return {pp:C.pp, growth:C.growthPool, stmt:JSON.stringify(C.stmt), res:JSON.stringify(Object.values(C.entries).flat().filter(e=>e.spent!=null).map(e=>e.spent))}})()")
        print('after roll', info)
        # dark theme file
        await pg.click('button.tab[data-tab="chars"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-act="toggleTheme"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/f-file-dark.png', full_page=True)
        await pg.click('[data-act="toggleTheme"]')
        # pathways
        await pg.click('button.tab[data-tab="chars"]'); 
        await pg.evaluate("DB.ui.cview='build'; render()")
        await pg.click('button[data-m="pathways"]'); await pg.click('#cfYes'); await pg.wait_for_timeout(200)
        await pg.evaluate("""(()=>{const C=curC(); C.pathways={0:{choice:'Gifted',els:[{type:'circle',name:'Mother Yolanda',link:'raised by'},{type:'triangle',name:'The Collapse',link:'born during'}],done:true},1:{choice:'Outsider',els:[{type:'location',name:'Rust Harbor',link:'grew up in'}]}}; touch(C);
           const S=curS(); const c2=newChar(S); c2.name='Pell'; c2.pathways={0:{els:[{type:'triangle',name:'The Collapse',link:'orphaned by'},{type:'org',name:'Salvage Guild',link:'member'}]}}; DB.chars[c2.id]=c2; render();})()""")
        await pg.screenshot(path=f'{OUT}/b-pathways.png', full_page=True)
        await pg.evaluate("DB.ui.cview='map'; render()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/m-map.png', full_page=True)
        # GM
        await pg.click('button.tab[data-tab="gm"]')
        for t in ['major','mob','boss','faction','location','extra']:
            await pg.click(f'[data-act="addGMC"][data-type="{t}"]'); await pg.wait_for_timeout(80)
        await pg.click('[data-act="gmcFill"][data-lvl="medium"]>>nth=0'); await pg.wait_for_timeout(100)
        await pg.click('[data-act="pushItem"][data-path="G.crisis"]')
        await pg.screenshot(path=f'{OUT}/g-gm.png', full_page=True)
        await pg.click('[data-act="gmNewSession"]'); await pg.click('#cfYes'); await pg.wait_for_timeout(200)
        await pg.click('button.tab[data-tab="rules"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/rules.png', full_page=True)
        # blank file + print
        await pg.evaluate("DB.ui.tab='chars'; DB.ui.cview='blank'; render()")
        await pg.emulate_media(media='print'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/p-blank-print.png', full_page=True)
        await pg.emulate_media(media='screen')
        # export player pack
        await pg.evaluate("DB.ui.tab='designer'; DB.ui.dsec='review'; render()")
        await pg.click('[data-act="expPack"]'); await pg.fill('#packPass','gm123')
        async with pg.expect_download() as dl:
            await pg.click('#packGo')
        d = await dl.value; path = str(ROOT/'test'/'out'/'pack.json'); await d.save_as(path)
        print('pack saved', os.path.getsize(path))
        # export character
        await pg.evaluate("DB.ui.tab='chars'; DB.ui.cview='file'; DB.ui.charId=Object.values(DB.chars).find(c=>c.name==='Juno Okafor').id; render()")
        await pg.click('[data-act="charMenu"]')
        async with pg.expect_download() as dl2:
            await pg.click('[data-act="expChar"]')
        d2 = await dl2.value; cpath=str(ROOT/'test'/'out'/'char.json'); await d2.save_as(cpath)
        # mobile
        m = await b.new_page(viewport={'width':390,'height':844})
        await m.goto(URL); await m.evaluate(SETUP)
        await m.evaluate("(()=>{const S=curS(); const c=newChar(S); c.name='Mobile Test'; DB.chars[c.id]=c; DB.ui.charId=c.id; DB.ui.tab='chars'; DB.ui.cview='file'; render();})()")
        await m.wait_for_timeout(300)
        await m.screenshot(path=f'{OUT}/mob-file.png', full_page=True)
        sw = await m.evaluate("document.documentElement.scrollWidth")
        await m.evaluate("DB.ui.tab='designer'; DB.ui.dsec='traits'; render()"); await m.wait_for_timeout(200)
        await m.screenshot(path=f'{OUT}/mob-designer.png', full_page=False)
        sw2 = await m.evaluate("document.documentElement.scrollWidth")
        await m.evaluate("DB.ui.tab='dice'; render()"); await m.wait_for_timeout(200)
        await m.screenshot(path=f'{OUT}/mob-dice.png', full_page=True)
        sw3 = await m.evaluate("document.documentElement.scrollWidth")
        await m.evaluate("DB.ui.tab='chars'; DB.ui.cview='build'; render()"); await m.wait_for_timeout(200)
        sw4 = await m.evaluate("document.documentElement.scrollWidth")
        await m.screenshot(path=f'{OUT}/mob-build.png', full_page=True)
        print('mobile scrollWidths', sw, sw2, sw3, sw4)
        # import pack into fresh profile
        ctx2 = await b.new_context(viewport={'width':1360,'height':900})
        p2 = await ctx2.new_page(); p2.on('pageerror', lambda e: errs.append('P2ERR '+str(e)))
        await p2.goto(URL); await p2.wait_for_timeout(300)
        txt = open(path).read()
        await p2.evaluate("t => importText(t)", txt); await p2.wait_for_timeout(300)
        tabs = await p2.eval_on_selector_all('button.tab', 'bs=>bs.map(b=>b.textContent)')
        print('player tabs', tabs)
        await p2.screenshot(path=f'{OUT}/pack-chars.png', full_page=True)
        await p2.evaluate("t => importText(t)", open(cpath).read()); await p2.wait_for_timeout(300)
        await p2.screenshot(path=f'{OUT}/pack-charimport.png', full_page=True)
        # unlock with wrong/right pass
        await p2.evaluate("A.unlockSetting({dataset:{id:curS().id}})"); await p2.fill('#pbIn','nope'); await p2.click('#pbOk'); await p2.wait_for_timeout(100)
        locked = await p2.evaluate("isLocked(curS())")
        await p2.evaluate("A.unlockSetting({dataset:{id:curS().id}})"); await p2.fill('#pbIn','gm123'); await p2.click('#pbOk'); await p2.wait_for_timeout(100)
        locked2 = await p2.evaluate("isLocked(curS())")
        print('locked after wrong', locked, 'after right', locked2)
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
