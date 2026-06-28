const { chromium } = require('/opt/node22/lib/node_modules/playwright/node_modules/playwright-core');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:960,height:520}});
  const errs=[];p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push(m.text());});
  await p.goto('http://127.0.0.1:8099/game.html?demo=1',{waitUntil:'load'});
  await p.waitForFunction(()=>window.BattleUI&&window.Battle&&window.GameData,{timeout:15000});
  await p.evaluate(()=>window.BattleUI.start(window.GameData.STAGES.find(s=>s.id===1)));
  for(let i=0;i<8;i++){try{const x=await p.$('text=跳过');if(x)await x.click({timeout:300});}catch(e){}await p.waitForTimeout(180);}
  await p.waitForTimeout(800);
  const tests=[['lecliss','inferno','sig→cast'],['lecliss','cls_arcane','class→cast_class'],
               ['justia','oath_aegis','sig→cast'],['justia','cls_guard','class→cast_class']];
  for(const [char,skill,lbl] of tests){
    const info=await p.evaluate(({char,skill})=>{
      const B=window.Battle,U=window.BattleUI;
      const c=B.combatants.find(x=>x.side==='ally'&&x.alive!==false);
      const t=B.combatants.find(x=>x.side==='enemy'&&x.alive!==false);
      if(!c||!t) return {err:'no combatant'};
      c.charId=char;
      U.busy=false; U._fxDefer=null;
      try{ U.execute(c, skill, t); }catch(e){ return {err:String(e)} }
      const cls=(window.GameData.CHARACTERS[char]||{}).cls;
      const classSkill=window.GameData.CLASS_SKILL_OF[cls];
      return {anim: skill===classSkill?'cast_class':'cast', hasVfx: !!U.SKILL_VFX[skill], cls};
    },{char,skill});
    await p.waitForTimeout(820);
    await p.screenshot({path:`sk_${char}_${skill}.png`});
    console.log(char,skill,lbl,'=>',JSON.stringify(info));
    await p.waitForTimeout(1500);
  }
  console.log('errors:',errs.length?errs.slice(0,4):'none');
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
