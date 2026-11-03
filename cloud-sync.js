(function () {
"use strict";
const cfg = window.GAOSTUDY_CLOUD_CONFIG;
if (!cfg) return;
const url = "https://iqlnwzxmtjjgzisufljd.supabase.co";
const publishable = "sb_publishable_jnY3xbWPgPFBd6naW35bXQ_tzZcNOTE";
const key = "gaostudy-cloud-attempts-v1:" + cfg.quizId;
let sb = null, user = null, unlocked = false, working = false;
const $ = (id) => document.getElementById(id);
const css = document.createElement("style");
css.textContent = '.gaocloud{border:1px solid #cbdfe9;background:#f4faff;border-radius:14px;padding:14px 17px;margin:16px 0;box-shadow:0 3px 12px #163e590c}.gaocloud h2{font-size:19px;margin:0 0 5px;color:#214d6f}.gaocloud p{font-size:13px;color:#48677b;margin:4px 0 9px}.gaocloud-fields{display:flex;flex-wrap:wrap;gap:10px;align-items:end}.gaocloud-fields label{display:flex;flex-direction:column;gap:4px;min-width:140px;flex:1;font-size:13px;font-weight:700}.gaocloud-fields input,.gaocloud-fields select{width:100%;border:1px solid #bdd5e2;background:white;border-radius:8px;padding:9px;color:#213c50;font-size:15px}.gaocloud-buttons{display:flex;flex-wrap:wrap;gap:8px;margin:11px 0 4px}.gaocloud-buttons button{background:#fff;border:1px solid #b8d1e1;border-radius:8px;padding:9px 13px;font-size:14px;font-weight:700;color:#245a7b}.gaocloud-buttons button:first-child{background:#2675b5;border-color:#2675b5;color:white}.gaocloud-buttons button:disabled{opacity:.5}.gaocloud-status{padding:8px 10px;border-radius:8px;background:#fff;color:#365b74;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.gaocloud-status[data-error=true]{background:#fff0ed;color:#a23425}@media(max-width:600px){.gaocloud-buttons button{flex:1 1 45%}}';
document.head.appendChild(css);
const section = document.createElement("section");
section.className = "gaocloud";
section.innerHTML = '<h2>☁️ 家庭学习云端记录</h2><p>完成试卷并点击「提交批改」后，自动保存每道题的答案和错题。离线时先留在本机，之后可重试同步。</p>' +
  '<div class="gaocloud-fields"><label>孩子<input id="gaocloud-kid" type="text" readonly></label><label>学期<input id="gaocloud-semester" value="2026春" autocomplete="off"></label><label>学习阶段<select id="gaocloud-phase"><option value="预习">预习</option><option value="复习">复习</option><option value="期末" selected>期末</option></select></label><label>家庭暗号<input type="password" id="gaocloud-secret" placeholder="换设备需解锁" autocomplete="off"></label></div>' +
  '<div class="gaocloud-buttons"><button id="gaocloud-unlock" type="button">解锁家庭档案</button><button id="gaocloud-sync" type="button">重新同步本机记录</button></div><div class="gaocloud-status" id="gaocloud-status">正在连接…</div>';
(document.querySelector(".hero") || document.querySelector("main") || document.body).after(section);
$("gaocloud-kid").value = cfg.child;
$("gaocloud-phase").value = cfg.phase || "期末";
const read = () => { try { const x = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(x) ? x : []; } catch (_) { return []; } };
const write = (x) => { localStorage.setItem(key, JSON.stringify(x)); };
const status = (text, error) => { $("gaocloud-status").textContent = text; $("gaocloud-status").dataset.error = error ? "true" : "false"; };
const newId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
};
function resultItems() {
  if (cfg.type === "math") {
    if (typeof QUESTIONS === "undefined" || typeof given !== "function" || typeof norm !== "function") throw new Error("没有读到数学原卷题目");
    return QUESTIONS.map(q => {
      const answer = given(q);
      const ok = q.type === "choice" ? answer === q.answer : q.answer.map(norm).includes(norm(answer));
      const correctAnswer = q.type === "choice" ? q.answer + ". " + q.options[q.answer.charCodeAt(0) - 65] : q.answer.join(" / ") + (q.unit || "");
      return { correct_char: q.id, expected_word: correctAnswer, question_type: "数学-" + q.section + "-" + (q.type === "choice" ? "选择" : "填空"), given_answer: JSON.stringify({ question: q.q, answer, unit: q.unit || "", options: q.options || [] }), is_correct: ok };
    });
  }
  if (cfg.type === "english") {
    if (typeof DATA === "undefined" || typeof active === "undefined" || typeof answerOf !== "function" || typeof accepted !== "function") throw new Error("没有读到英语原卷题目");
    if (!active.length) throw new Error("请先开始默写，再提交试卷");
    return active.map((item, i) => {
      const answer = answerOf(i);
      return { correct_char: "en-" + (DATA.indexOf(item) + 1), expected_word: item.en, question_type: "英语-" + item.unit + "-默写", given_answer: JSON.stringify({ question: item.cn, answer, unit: item.unit }), is_correct: accepted(item, answer) };
    });
  }
  throw new Error("未知试卷类型");
}
function saveFinished() {
  const items = resultItems();
  const correct = items.filter(x => x.is_correct).length;
  let score = Math.round(correct / items.length * 10000) / 100;
  if (cfg.type === "math") {
    score = QUESTIONS.reduce((sum, q, i) => sum + (items[i].is_correct ? q.points : 0), 0);
  }
  const timestamp = new Date().toISOString();
  const record = {
    id: newId(), child_name: cfg.child, quiz_id: cfg.quizId,
    semester: $("gaocloud-semester").value.trim() || "2026春",
    phase: ($("gaocloud-phase").value || "期末") + "-" + cfg.title,
    round_no: null, total_questions: items.length, correct_questions: correct,
    score, completed_at: timestamp,
    items: items.map(x => Object.assign({}, x, { answered_at: timestamp })), synced: false
  };
  const all = read(); all.push(record); write(all);
  status("已在本机保存本次记录（" + correct + "/" + items.length + "题）。" + (unlocked ? "正在上传云端…" : "先解锁家庭档案即可上传。"));
  return record;
}
async function identity() {
  if (!sb) throw new Error("云端组件尚未加载");
  let a = await sb.auth.getSession();
  if (a.error) throw a.error;
  if (!a.data.session) {
    a = await sb.auth.signInAnonymously();
    if (a.error) throw a.error;
  }
  const r = await sb.auth.getUser();
  if (r.error || !r.data.user) throw r.error || new Error("身份获取失败");
  user = r.data.user;
  return user;
}
async function checkAccess() {
  await identity();
  const result = await sb.from("family_access").select("user_id").eq("user_id", user.id).maybeSingle();
  if (result.error) throw result.error;
  unlocked = !!result.data;
  const waiting = read().filter(a => !a.synced).length;
  status(unlocked ? "家庭档案已解锁 · 本机待同步 " + waiting + " 次" : "云端已连接，但家庭档案尚未解锁。本机待同步 " + waiting + " 次。");
  return unlocked;
}
async function sync() {
  if (working) return;
  working = true;
  $("gaocloud-sync").disabled = true;
  try {
    if (!unlocked) {
      if (!await checkAccess()) { status("请先输入家庭暗号解锁，再进行同步。", true); return; }
    }
    const all = read();
    let succeeded = 0;
    for (const attempt of all) {
      if (attempt.synced) continue;
      const existing = await sb.from("quiz_attempts_secure").select("id").eq("id", attempt.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) {
        const { items, synced, ...record } = attempt;
        const ins = await sb.from("quiz_attempts_secure").insert(Object.assign({}, record, { created_by: user.id }));
        if (ins.error) throw ins.error;
      }
      const found = await sb.from("quiz_item_results_secure").select("id").eq("attempt_id", attempt.id).limit(attempt.items.length + 1);
      if (found.error) throw found.error;
      if (!found.data.length) {
        const rows = attempt.items.map(item => Object.assign({}, item, {
          attempt_id: attempt.id, created_by: user.id,
          child_name: attempt.child_name, semester: attempt.semester
        }));
        const inserted = await sb.from("quiz_item_results_secure").insert(rows);
        if (inserted.error) throw inserted.error;
      } else if (found.data.length !== attempt.items.length) {
        throw new Error("发现一份云端记录的题目数量不完整，已停止以防重复： " + attempt.id);
      }
      attempt.synced = true;
      write(all);
      succeeded++;
    }
    const count = await sb.from("quiz_attempts_secure")
      .select("id", { count: "exact", head: true })
      .eq("child_name", cfg.child).eq("quiz_id", cfg.quizId);
    const pending = all.filter(a => !a.synced).length;
    status("同步成功：" + succeeded + "次新记录；本机待同步 " + pending + " 次。" + (count.error ? "" : " 此卷云端累计 " + count.count + " 次。"));
  } catch (error) {
    status("同步失败，本机记录保留，可再次点击同步：" + (error.message || error), true);
  } finally {
    working = false;
    $("gaocloud-sync").disabled = false;
  }
}
async function unlock() {
  if (working) return;
  const secret = $("gaocloud-secret").value.trim();
  if (!secret) { status("请先输入家庭暗号。", true); return; }
  working = true;
  $("gaocloud-unlock").disabled = true;
  try {
    await identity();
    const out = await sb.functions.invoke("unlock-family", { body: { passphrase: secret } });
    if (out.error) throw out.error;
    if (!out.data || out.data.ok !== true) throw new Error((out.data && out.data.error) || "家庭暗号不正确");
    $("gaocloud-secret").value = "";
    await checkAccess();
  } catch (error) {
    status("解锁失败：" + (error.message || error), true);
  } finally {
    working = false;
    $("gaocloud-unlock").disabled = false;
  }
  if (unlocked) await sync();
}
const originalButton = $("gradeBtn");
if (originalButton) {
  originalButton.addEventListener("click", () => {
    try {
      saveFinished();
      if (unlocked) sync();
    } catch (error) {
      status("本机记录保存失败：" + (error.message || error), true);
    }
  });
}
$("gaocloud-unlock").addEventListener("click", unlock);
$("gaocloud-sync").addEventListener("click", sync);
try {
  if (!window.supabase) throw new Error("Supabase JS 未加载，请检查网络");
  sb = window.supabase.createClient(url, publishable, { auth: { persistSession: true, autoRefreshToken: true } });
  checkAccess().then(ok => { if (ok && read().some(x => !x.synced)) sync(); })
    .catch(e => status("云端连接失败：" + (e.message || e), true));
} catch (e) {
  status("云端暂不可用，仍可以本机保存完成记录：" + (e.message || e), true);
}
})();