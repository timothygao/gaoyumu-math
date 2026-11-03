(function(){
"use strict";
const config=window.GAOSTUDY_CLOUD_CONFIG;
if(!config || (config.type!=="math" && config.type!=="english"))return;
const $=id=>document.getElementById(id);
const kind=config.type;
const kid=config.child;
const safeText=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let scope="ALL", currentRound=1, fullPool=[], state=null, showPendingOnly=true, latestSnapshot=null;
function blank(){return {version:1,rounds:{},drafts:{},manual:{},history:[]};}
function key(){return "gao-three-round-review-v1:"+config.quizId+":"+scope;}
function load(){try{const x=JSON.parse(localStorage.getItem(key())||"null");return x&&x.version===1?Object.assign(blank(),x):blank();}catch(e){return blank();}}
function persist(){try{localStorage.setItem(key(),JSON.stringify(state));}catch(e){alert("本机保存失败，请检查浏览器存储权限");}}
function allItems(){return kind==="math"?QUESTIONS:active;}
function codeOf(item){return kind==="math"?item.id:"en-"+(DATA.indexOf(item)+1);}
function correctAns(item){return kind==="math"?item.type==="choice"?item.answer+". "+item.options[item.answer.charCodeAt(0)-65]:item.answer.join(" / ")+(item.unit||""):item.en;}
function question(item){return kind==="math"?item.q:item.cn;}
function submitted(r){return !!(state.rounds[r]&&state.rounds[r].done);}
function masteredAt(item,limit){
  const id=codeOf(item);
  for(let r=1;r<limit;r++)if(submitted(r)&&state.rounds[r].correct&&state.rounds[r].correct[id])return r;
  return 0;
}
function needed(item,r){return !masteredAt(item,r);}
function indexOf(item){return allItems().indexOf(item);}
function cardOf(item){
  return $(kind==="math"?"card-"+item.id:"card-"+indexOf(item));
}
function answerOfItem(item){
  return kind==="math"?given(item):answerOf(indexOf(item));
}
function evaluate(item,answer){
  return kind==="math"?(item.type==="choice"?answer===item.answer:item.answer.map(norm).includes(norm(answer))):accepted(item,answer);
}
function elementsOf(card){
  return Array.from(card.querySelectorAll(kind==="math"?'input[type="radio"],input.answer-input':'input[data-index]'));
}
function getAnswers(){
  const out={};allItems().forEach(item=>out[codeOf(item)]=answerOfItem(item));return out;
}
function restoreAnswers(){
  const draft=state.drafts[currentRound]||{};
  const data=submitted(currentRound)?(state.rounds[currentRound].answers||{}):draft;
  allItems().forEach(item=>{
    const card=cardOf(item),v=data[codeOf(item)]||"";
    if(kind==="math"){
      if(item.type==="choice"){
        card.querySelectorAll('input[type="radio"]').forEach(el=>{el.checked=el.value===v;});
      }else{
        const field=card.querySelector("input.answer-input");if(field)field.value=v;
      }
    }else{
      const field=card.querySelector("input[data-index]");if(field)field.value=v;
    }
  });
}
function renderStatus(){
  if(!$("review-toolbar"))return;
  const prevDone=currentRound===1||submitted(currentRound-1);
  const relevant=fullPool.filter(item=>needed(item,currentRound));
  const answered=relevant.filter(item=>String(answerOfItem(item)||"").trim()).length;
  const finished=submitted(currentRound);
  $("review-round").value=String(currentRound);
  $("review-filter").textContent="只显示待巩固题："+(showPendingOnly?"开":"关");
  $("review-summary").textContent="第"+currentRound+"轮：需作答 "+relevant.length+" 题，已填写 "+answered+" 题；此前已掌握 "+(fullPool.length-relevant.length)+" 题。"+(prevDone?"":"请先完成上一轮。");
  const gradeButton=$("gradeBtn");
  if(gradeButton){
    gradeButton.disabled=!prevDone||(!finished&&relevant.length>0&&answered<relevant.length);
    gradeButton.textContent=finished?"查看本轮批改结果":relevant.length===0?"本轮无需重做":"批改并显示答案";
  }
  const nextButton=$("review-next");if(nextButton){nextButton.disabled=currentRound===3||!submitted(currentRound);nextButton.textContent=currentRound===3?"三轮结束":"进入第"+(currentRound+1)+"轮（只练待巩固）";}
  allItems().forEach(item=>{
    const card=cardOf(item),id=codeOf(item),past=masteredAt(item,currentRound);
    if(!card)return;
    card.style.display=(showPendingOnly&&!!past)?"none":"";
    card.style.opacity=past?"0.65":"1";
    elementsOf(card).forEach(el=>el.disabled=!!past||finished);
    let label=card.querySelector(".review-mark");
    if(!label){label=document.createElement("div");label.className="review-mark";card.appendChild(label);}
    const currentCorrect=finished&&state.rounds[currentRound].correct?.[id];
    const currentWrong=finished&&!currentCorrect&&!past;
    const manual=!!state.manual[currentRound]?.[id];
    label.innerHTML='<label><input type="checkbox" data-review-check="'+safeText(id)+'" '+(currentCorrect||manual?'checked ':'')+(finished||past?'disabled':'')+'> 独立做对勾选</label><span class="review-label '+(past||currentCorrect?"good":currentWrong?"bad":"")+'">'+(past?"第"+past+"轮已掌握 · 本轮免做":currentCorrect?"第"+currentRound+"轮已掌握":currentWrong?"待巩固":manual?"已勾选 · 待核对":"待练习")+"</span>";
    label.querySelector("input").addEventListener("change",e=>{
      if(!state.manual[currentRound])state.manual[currentRound]={};
      state.manual[currentRound][id]=e.target.checked;persist();renderStatus();
    });
  });
}
function capture(){
  if(submitted(currentRound))return;
  state.drafts[currentRound]=getAnswers();
  persist();
  renderStatus();
}
function clearFeedback(){
  const report=$("report");if(report){report.style.display="none";report.innerHTML="";}
  allItems().forEach(item=>{
    const card=cardOf(item);
    if(card){card.classList.remove("correct","wrong");const fb=card.querySelector(".feedback");if(fb){fb.innerHTML="";}}
  });
}
function rebuild(){
  render();
  $("exam").style.display="block";
  clearFeedback();restoreAnswers();renderStatus();
}
function showReport(data){
  let correct=0,points=0;
  const details=[];
  const r=currentRound;
  allItems().filter(item=>needed(item,r)).forEach(item=>{
    const id=codeOf(item),ans=data.answers[id]||"",ok=!!data.correct[id];
    if(ok){correct++;points+=kind==="math"?item.points:1;}
    const card=cardOf(item);if(card){
      card.classList.remove("correct","wrong");card.classList.add(ok?"correct":"wrong");
      const fb=card.querySelector(".feedback");
      if(fb)fb.innerHTML=(ok?"<b>本轮掌握。</b> ":"<b>待巩固。</b> ")+"参考答案："+safeText(correctAns(item))+(item.explain?"<br>"+safeText(item.explain):"");
    }
    if(!ok)details.push({id,item});
  });
  const report=$("report");
  const score=kind==="math"?points:Math.round(correct/(Math.max(1,data.total))*100);
  report.innerHTML='<div class="report-head"><div><h2>第'+r+'轮 · 批改报告</h2><div class="score">'+score+' <span style="font-size:16px">'+(kind==="math"?"分（本轮题目得分）":"分")+'</span></div><div style="font-size:13px;color:#61758b">本轮作答 '+data.total+' 题；掌握 '+correct+' 题；待巩固 '+details.length+' 题</div></div></div>'+
    '<div class="report-body"><div class="hint">第'+(r<3?r+1:"3")+'轮只需复习仍待巩固的题目；前面已掌握的题不会再要求作答。</div>'+
    (details.length?'<div class="mistake-list">'+details.map(x=>'<span class="chip">'+safeText(question(x.item).slice(0,27))+'</span>').join("")+'</div>':'<p>本轮题目全部掌握。</p>')+'</div>';
  report.style.display="block";
}
function gradeCurrent(){
  latestSnapshot=null;
  if(submitted(currentRound)){
    clearFeedback();showReport(state.rounds[currentRound]);renderStatus();return;
  }
  if(currentRound>1&&!submitted(currentRound-1)){alert("请先完成上一轮。");return;}
  const list=fullPool.filter(item=>needed(item,currentRound));
  if(!list.length){
    state.rounds[currentRound]={done:true,answers:{},correct:{},total:0,score:100};
    persist();renderStatus();return;
  }
  const missing=list.filter(item=>!String(answerOfItem(item)||"").trim());
  if(missing.length){alert("本轮还有 "+missing.length+" 道待巩固题未作答；不需要填写此前已掌握的题。");renderStatus();return;}
  const answers=getAnswers(),correct={};let points=0;
  const cloudItems=[];
  for(const item of list){
    const id=codeOf(item),v=answers[id]||"",ok=evaluate(item,v);
    correct[id]=ok;if(ok)points+=kind==="math"?item.points:1;
    cloudItems.push({
      correct_char:id,expected_word:correctAns(item),
      question_type:(kind==="math"?"数学-"+item.section+"-"+(item.type==="choice"?"选择":"填空"):"英语-"+item.unit+"-默写"),
      given_answer:JSON.stringify({question:question(item),answer:v,scope,round:currentRound}),
      is_correct:ok
    });
  }
  const score=kind==="math"?points:Math.round(points/list.length*10000)/100;
  state.rounds[currentRound]={done:true,answers,correct,total:list.length,score};
  delete state.drafts[currentRound];
  persist();
  latestSnapshot={roundNo:currentRound,scope,items:cloudItems,score,correct:cloudItems.filter(x=>x.is_correct).length};
  showReport(state.rounds[currentRound]);renderStatus();
  $("report").scrollIntoView({behavior:"smooth",block:"start"});
}
function start(){
  scope=kind==="english"?$("unitSelect").value:"ALL";
  fullPool=allItems().slice();
  state=load();
  currentRound=1;
  showPendingOnly=true;
  rebuild();
}
function jump(r){
  if(r>1&&!submitted(r-1)){alert("请先完成第"+(r-1)+"轮的待巩固题。");$("review-round").value=String(currentRound);return;}
  if(!submitted(currentRound))capture();
  currentRound=r;showPendingOnly=true;rebuild();
}
const css=document.createElement("style");
css.textContent='.review-toolbar{border:1px solid #bed6e5;background:#f3faff;border-radius:12px;margin:14px 0;padding:13px 15px}.review-controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.review-controls select{width:auto;min-width:125px}.review-controls button{border:1px solid #b4cedd;border-radius:9px;padding:9px 12px;background:#fff;color:#24658c}.review-controls button:disabled{opacity:.55}.review-summary{font-size:13px;color:#42657d;margin:9px 0 0}.review-mark{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:11px;border-top:1px dashed #d4e0e8;padding-top:10px;font-size:13px}.review-mark label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}.review-mark input{width:auto!important}.review-label{background:#edf2f6;color:#4b6171;border-radius:99px;padding:3px 9px}.review-label.good{background:#e8f8ef;color:#146745}.review-label.bad{background:#fff0e9;color:#9d3c28}@media(max-width:650px){.review-controls>*{flex:1 1 auto}}';
document.head.appendChild(css);
const toolbar=document.createElement("section");toolbar.className="review-toolbar";toolbar.id="review-toolbar";
toolbar.innerHTML='<div class="review-controls"><label>当前轮次 <select id="review-round"><option value="1">第1轮</option><option value="2">第2轮</option><option value="3">第3轮</option></select></label><button type="button" id="review-filter">只显示待巩固题：开</button><button type="button" id="review-next">进入下一轮</button></div><p id="review-summary" class="review-summary"></p>';
const exam=$("exam");
const insertion=exam.querySelector(".overview")||exam.firstElementChild;
if(insertion)insertion.insertAdjacentElement("afterend",toolbar);else exam.prepend(toolbar);
const originalGrade=$("gradeBtn");
const clonedGrade=originalGrade.cloneNode(true);originalGrade.replaceWith(clonedGrade);
clonedGrade.addEventListener("click",gradeCurrent);
const originalReset=$("resetBtn");
if(originalReset){const fresh=originalReset.cloneNode(true);originalReset.replaceWith(fresh);
  fresh.textContent="清空本轮未提交答案";
  fresh.addEventListener("click",()=>{if(submitted(currentRound)){alert("这一轮已完成。历史记录不会被删除，请直接进入下一轮。");return;}
    state.drafts[currentRound]={};persist();rebuild();});}
$("startBtn").addEventListener("click",start);
$("review-round").addEventListener("change",e=>jump(Number(e.target.value)));
$("review-next").addEventListener("click",()=>jump(Math.min(3,currentRound+1)));
$("review-filter").addEventListener("click",()=>{showPendingOnly=!showPendingOnly;renderStatus();});
exam.addEventListener("input",e=>{if(e.target.matches('input[data-index],input.answer-input,input[type="radio"]'))capture();});
exam.addEventListener("change",e=>{if(e.target.matches('input[data-index],input.answer-input,input[type="radio"]'))capture();});
window.GAOSTUDY_ROUND_API={takeSnapshot:()=>{const data=latestSnapshot;latestSnapshot=null;return data;}};
})();