// ---------- career-assist.js ---------

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

// ---------- Firebase config  ----------
const firebaseConfig = {
  apiKey: "AIzaSyAhpo0Qg4GTgomPPxra6B-1MXOY3mmhHgY",
  authDomain: "viscaraiassist-5e2c5.firebaseapp.com",
  projectId: "viscaraiassist-5e2c5",
  storageBucket: "viscaraiassist-5e2c5.appspot.com",
  messagingSenderId: "19772791247",
  appId: "1:19772791247:web:0362505efcf02269785aba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadLastFlashMessages() {
  if (!currentUser || !currentUser.uid) return;
  try {
    const messagesCol = collection(db, "flash_chats", currentUser.uid, "messages");
    const q = query(messagesCol, orderBy("ts", "desc"), limit(25));  // Get latest 25 messages
    const snaps = await getDocs(q);

    const docs = [];
    snaps.forEach(d => {
      const dt = d.data() || {};
      docs.push({ role: dt.role || "assistant", text: dt.text || "", ts: dt.ts || 0 });
    });

    const messages = docs.reverse(); 

    // Append messages to chat UI
    messages.forEach(m => {
      if (m.role === 'user') appendBubble(m.text, true);
      else appendBotHTML(`<div class="text-sm">${escapeHtml(m.text).replace(/\*\*/g, '').replace(/\n/g, '<br/>')}</div>`);
    });

  } catch (e) {
    console.warn("Failed to load flash messages from Firestore:", e);
  }
}

// ---------- Auth init & state ----------
const auth = getAuth();
let currentUser = null;
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  // update UI if #caUser exists
  const caUser = document.getElementById('caUser');
  if (caUser) {
    if (user) caUser.textContent = user.displayName || user.email || "User";
    else caUser.textContent = "[Guest]";
  }

  const intro = document.getElementById('surveyIntro');
  if (intro) {
    const nameSpan = intro.querySelector('#caUser');
    if (nameSpan) nameSpan.textContent = currentUser ? (currentUser.displayName || currentUser.email || "User") : "[UserName]";
  }

  // If logged in, attempt to load the user's latest survey and render persistent UI
  if (currentUser) {
    try {
      await loadLastSurveyForUser();
    } catch (e) {
      console.warn("loadLastSurveyForUser failed:", e);
    }
  }
    try {
    await loadLastFlashMessages();  
  } catch (e) {
    console.warn("loadLastFlashMessages failed:", e);
  }
});

// ---------- existing helpers ----------
function attachLoginButtons() {
  document.querySelectorAll(".btn-login").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
      window.location.href = "./login.html";
    });
  });
}
attachLoginButtons();

function updateRoleButtonsState() {
  // Buttons should be enabled when NO role has been chosen for this survey.
  const allowSelection = !surveyChosenRole; 
  document.querySelectorAll('.role-btn').forEach(btn => {
   
    btn.title = "";

    if (allowSelection) {
      // enable button visually & functionally
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-70','pointer-events-none','bg-[#f3e8e3]','text-[#a77a6a]','opacity-50','cursor-not-allowed');
      btn.classList.add('bg-[#d3ab9e]','text-white');
      btn.setAttribute('aria-disabled', 'false');

      // attach click handler once which avoid duplicates
      if (!btn.dataset.handlerAttached) {
        btn.addEventListener('click', async (ev) => {
          const role = btn.getAttribute('data-role');
          if (!role) return;
          const origHtml = btn.innerHTML;
          const origDisabled = btn.disabled;
          try {
            btn.disabled = true;
            btn.innerHTML = `${createButtonSpinner()}Processing...`;
            await requestRoadmapForRole(role);
            // requestRoadmapForRole now sets surveyChosenRole and calls updateRoleButtonsState()
          } catch (err) {
            console.error("Role button click error:", err);
          } finally {
            btn.disabled = origDisabled;
            btn.innerHTML = origHtml;
          }
        });
        btn.dataset.handlerAttached = '1';
      }
    } else {
      // disable button visually & functionally (because a role was chosen)
      btn.setAttribute('disabled', 'true');
      btn.classList.add('opacity-70','pointer-events-none','bg-[#f3e8e3]','text-[#a77a6a]','opacity-50','cursor-not-allowed');
      btn.classList.remove('bg-[#d3ab9e]','text-white');
      btn.setAttribute('aria-disabled', 'true');
    }
  });
}

// ---------- Day-in-the-Life Simulation State ----------
let simulationActive = false;
let simulationRole = null;
let simulationStage = null; 
// stages: "intro" | "await_confirmation" | "tasks"

const sendBtn = document.getElementById('sendBtn');
const composer = document.getElementById('composer');
const chatScroll = document.getElementById('chatScroll');

// Path to assistant avatar image 
const ASSISTANT_AVATAR = './assets/assistant-avatar.png';


(function injectAssistantAvatarStyles(){
  if (document.getElementById('assistant-avatar-styles')) return;
  const style = document.createElement('style');
  style.id = 'assistant-avatar-styles';
  style.textContent = `
/* assistant chat avatar styles */
.chat-assistant-row { display:flex; gap:10px; align-items:flex-start; }
.chat-assistant-avatar { width:36px; height:36px; border-radius:8px; flex:0 0 36px; overflow:hidden; background:#fff; border:1px solid #eee; display:inline-flex; align-items:center; justify-content:center; }
.chat-assistant-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
.chat-assistant-bubble { max-width: calc(85% - 46px); /* leave space for avatar */ box-sizing:border-box; }
.chat-assistant-placeholder-icon { width:20px; height:20px; opacity:0.6; }
  `;
  document.head.appendChild(style);
})();

// UI appenders 
function appendBubble(text, me=false) {
  const wrap = document.createElement('div');
  wrap.className = 'relative bubble ' +
    (me ? 'me ml-auto bg-[#eac9c1] border border-[#d49382] text-white'
        : 'bg-[#f7f0ec] border border-[#f3e8e3]') +
    ' max-w-[85%] rounded-2xl p-3 text-sm shadow-sm';
  wrap.textContent = text;
  chatScroll.appendChild(wrap);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return wrap;
}

function appendBotHTML(htmlContent, options = {}) {
  const showAvatar = (typeof options.avatar === 'boolean') ? options.avatar : true;
  if (showAvatar) {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative chat-assistant-row';

    // avatar container 
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'chat-assistant-avatar';

    if (ASSISTANT_AVATAR) {
      const img = document.createElement('img');
      img.src = ASSISTANT_AVATAR;
      img.alt = 'Assistant';
      img.onerror = function(){
        avatarWrap.innerHTML = `<svg class="chat-assistant-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
      };
      avatarWrap.appendChild(img);
    } else {
      avatarWrap.innerHTML = `<svg class="chat-assistant-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }

    // bubble container 
    const bubbleContainer = document.createElement('div');
    bubbleContainer.className = 'chat-assistant-bubble relative bubble bg-[#f7f0ec] border border-[#f3e8e3] rounded-2xl p-3 text-sm shadow-sm';
    bubbleContainer.innerHTML = htmlContent;

    wrapper.appendChild(avatarWrap);
    wrapper.appendChild(bubbleContainer);

    chatScroll.appendChild(wrapper);
    chatScroll.scrollTop = chatScroll.scrollHeight;
    return wrapper;
  } else {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative'; 

    const bubbleContainer = document.createElement('div');
    bubbleContainer.className = 'relative bubble bg-[#f7f0ec] border border-[#f3e8e3] rounded-2xl p-3 text-sm shadow-sm';
    bubbleContainer.innerHTML = htmlContent;

    wrapper.appendChild(bubbleContainer);

    chatScroll.appendChild(wrapper);
    chatScroll.scrollTop = chatScroll.scrollHeight;
    return wrapper;
  }
}

// ---------- Typing indicator ----------
function showTypingIndicator(messages = ['......',' Generating response...', 'Finalizing...', 'Career Recommendation...'], intervalMs = 900) {
  const t = document.createElement('div');
  t.className = 'relative bubble bg-[#f7f0ec] border border-[#f3e8e3] max-w-[25%] rounded-2xl p-3 text-sm shadow-sm animate-pulse';
  const msgs = Array.isArray(messages) && messages.length > 0 ? messages : [String(messages)];
  let idx = 0;
  t.textContent = msgs[idx];
  chatScroll.appendChild(t);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  const id = setInterval(() => {
    idx = (idx + 1) % msgs.length;
    t.textContent = msgs[idx];
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }, intervalMs);
  t.dataset.timer = String(id);
  return t;
}

function removeNode(node) {
  if (!node) return;
  try {
    const timer = node.dataset && node.dataset.timer;
    if (timer) {
      clearInterval(Number(timer));
      delete node.dataset.timer;
    }
  } catch (e) {}
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

// ---------- Survey data & UI logic ----------
const surveyQuestions = [
  { key: "work_environment", q: "Q1. Which type of work environment do you prefer?", suggestions: ["Corporate","Startup","Government","Freelancer"] },
  { key: "subjects", q: "Q2. Which subjects/fields interest you most?", suggestions: ["Science","Arts","Tech","Business","Social Work"] },
  { key: "strengths", q: "Q3. What are your top strengths?", suggestions: ["Leadership","Problem-Solving","Creativity","Tech Skills"] },
  { key: "improvements", q: "Q4. Which skills do you want to improve?", suggestions: ["Communication","Time Management","Coding","Public Speaking"] },
  { key: "skills", q: "Q5. What skills do you already have?", suggestions: ["Programming","Design","Writing","Teaching","Management"] },
  { key: "experience", q: "Q6. Do you have career-related experience?", suggestions: ["Internship","Project","Work","None"] },
  { key: "confidence", q: "Q7. Rate your confidence in your skills (1–10)", suggestions: ["1","2","3","4","5","6","7","8","9","10"] },
  { key: "motivation", q: "Q8. What tasks motivate you most?", suggestions: ["Solving","Helping","Creating","Organizing"] },
  { key: "location", q: "Q9. Enter your current city/hometown (e.g., Mumbai, Delhi, Bangalore)", suggestions: [] },
  { key: "learning", q: "Q10. How do you prefer learning new skills?", suggestions: ["Courses","Projects","Mentorship","Classroom"] },
  { key: "resume_or_link", q: "Q11. If you have a resume/CV or GitHub/LinkedIn link paste it here (or type NA)", suggestions: [] }
];

let surveyIndex = 0;
let surveyAnswers = {};
let surveyActive = false;
let lastBotBubble = null;
let surveyDocRef = null;   
let persistedSurveyBubble = null; 
let surveyStage = null;
let surveyChosenRole = null;

function showNextQuestion() {
  if (surveyIndex >= surveyQuestions.length) {
    surveyActive = false;
    appendBubble("Thanks — analyzing your answers and getting career suggestions...", false);
    getCareerSuggestions();
    return;
  }

  const item = surveyQuestions[surveyIndex];
  let html = `<div class="text-sm font-medium mb-2">${escapeHtml(item.q)}</div>`;
  if (item.suggestions && item.suggestions.length > 0) {
    html += `<div class="flex flex-wrap gap-2 mt-2">`;
    item.suggestions.forEach(s => {
      html += `<button data-answer="${escapeHtml(s)}" class="survey-chip px-3 py-1 rounded-full bg-[#d3ab9e] text-white text-sm">${escapeHtml(s)}</button>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="text-xs text-gray-500 mt-2">Type your answer and press Send.</div>`;
  }

  lastBotBubble = appendBotHTML(html, { avatar: false });
  lastBotBubble.querySelectorAll('.survey-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = btn.getAttribute('data-answer');
      handleAnswer(val);
    });
  });

  surveyActive = true;
}

async function saveAnswerToFirestore(key, value) {
  try {
    if (!surveyDocRef) return;
    const updates = {};
    updates[`answers.${key}`] = value;
    updates['updatedAt'] = new Date();
    await updateDoc(surveyDocRef, updates);
  } catch (err) {
    console.warn("Firestore save error:", err);
  }
}

async function handleAnswer(answerText) {
  const item = surveyQuestions[surveyIndex];
  const value = String(answerText).trim();
  surveyAnswers[item.key] = value;

  appendBubble(value, true);

  if (lastBotBubble) {
    lastBotBubble.querySelectorAll('.survey-chip').forEach(n => n.remove());
  }

  await saveAnswerToFirestore(item.key, value);

  surveyIndex++;
  setTimeout(() => showNextQuestion(), 600);
}

// ---------- createSurveyDoc ----------
async function createSurveyDoc() {
  try {
    if (!currentUser) return;
    const docRef = doc(db, "surveys", currentUser.uid);
    const payload = {
      createdAt: new Date(),
      ownerUid: currentUser.uid,
      answers: {},
      stage: "in_progress",
      updatedAt: new Date()
    };
    await setDoc(docRef, payload, { merge: true });
    surveyDocRef = docRef;
    surveyStage = "in_progress";
    surveyChosenRole = null;
    surveyAnswers.chosenRole = "";
    updateRoleButtonsState();
  } catch (err) {
    console.error("Error creating survey doc:", err);
    surveyDocRef = null;
    surveyStage = null;
    surveyChosenRole = null;
  }
}

// ---------- Helper: Load user's last survey (UID doc preferred; fallback to latest ownerUid doc) ----------
async function loadLastSurveyForUser() {
  if (!currentUser) return;
  try {
    // Try the UID-keyed doc first
    const docRefByUid = doc(db, "surveys", currentUser.uid);
    const snap = await getDoc(docRefByUid);
    let surveyData = null;

    if (snap.exists()) {
      surveyDocRef = docRefByUid;
      surveyData = snap.data();
      surveyStage = surveyData.stage || null;        
      surveyChosenRole = surveyData.chosenRole || null;
      updateRoleButtonsState();
    } else {
      // Fallback: query by ownerUid, order by createdAt desc, limit 1
      const col = collection(db, "surveys");
      const q = query(col, where("ownerUid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(1));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        const first = snaps.docs[0];
        surveyDocRef = doc(db, "surveys", first.id);
        surveyData = first.data();
        surveyStage = surveyData.stage || null;      
        surveyChosenRole = surveyData.chosenRole || null;
        updateRoleButtonsState();
      }
    }

    if (!surveyData) {
      return;
    }

    // Populate local surveyAnswers with stored answers
    if (surveyData.answers && typeof surveyData.answers === 'object') {
      surveyAnswers = Object.assign({}, surveyData.answers);
    }

    // Render a persistent "survey summary" bubble in the chat window 
    renderPersistedSurveyBubble(surveyAnswers);

        // show the "Retake" UI since a previous survey exists
    try {
      renderIntroRetake();
    } catch (e) { /* ignore */ }

    if (surveyData.ai_suggestions) {
      // ai_suggestions expected to be the exact reply text created earlier
      renderSuggestionsAccordion(String(surveyData.ai_suggestions));
    }
    if (surveyData.skill_gap) {
      // assume shape { currentSkills, skillsToLearn, matchPercent, goal }
      const sg = surveyData.skill_gap;
      try {
        renderSkillGap({
          currentSkills: sg.currentSkills || [],
          skillsToLearn: sg.skillsToLearn || [],
          matchPercent: sg.matchPercent || sg.match || 0,
          goal: sg.goal || sg.goal || ""
        });
      } catch (e) { console.warn("renderSkillGap from persisted data failed:", e); }
    }
    if (surveyData.roadmap_text) {
  try {
    const sanitized = sanitizeRoadmapText(String(surveyData.roadmap_text));
    renderRoadmapPanel(sanitized);
    // create pdf link 
    await createRoadmapPDF(sanitized, surveyData.chosenRole || "");

    // ensure users doc contains roadmap_text / chosenRole for Dashboard
    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          goals: surveyData.chosenRole || "",
          roadmap_text: sanitized,
          updatedAt: new Date()
          }, { merge: true });
        }
      } catch (e) { /* ignore */ }
    } catch (e) { console.warn("renderRoadmapPanel/createRoadmapPDF failed:", e); }
  }
  } catch (err) {
    console.warn("loadLastSurveyForUser error:", err);
  }
}

// render a persistent summary bubble for the last survey answers
function renderPersistedSurveyBubble(answers) {
  try {
    // remove old persisted bubble if present
    if (persistedSurveyBubble && persistedSurveyBubble.parentNode) {
      persistedSurveyBubble.parentNode.removeChild(persistedSurveyBubble);
      persistedSurveyBubble = null;
    }

    // Build a short readable summary
    const keys = Object.keys(answers || {});
    if (keys.length === 0) return;

    let html = `<div class="text-sm font-medium mb-1">Your last saved survey (tap on "Start Your Survey" to edit your survey answers):</div><div class="text-xs text-gray-700">`;
    keys.forEach(k => {
      const label = escapeHtml(k.replace(/_/g, ' '));
      const val = escapeHtml(String(answers[k]).slice(0, 300));
      html += `<div style="margin-bottom:4px;"><strong>${label}:</strong> ${val}</div>`;
    });
    html += `</div>`;

    persistedSurveyBubble = appendBotHTML(html, { avatar: false });
    persistedSurveyBubble.dataset.persisted = "true";
  } catch (e) {
    console.warn("renderPersistedSurveyBubble error:", e);
  }
}

// ---------- FRONTEND PROMPT BUILDING & BACKEND CALLS ----------
function buildSuggestionsPrompt(answers) {
  const compact = Object.entries(answers).map(([k,v]) => `${k}:${v}`).join(" | ");
  return `Analyze the following user profile and provide career role recommendations aligned with their chosen career goal.  
Organize results into exactly three categories:  
1. Current Job Market  
2. Job Opportunities in User's Location  
3. Future Job Market  

For each category, return exactly 3 job roles (no more, no less).  
Format each role as:  
- Role — one short, specific reason why it fits the user’s profile  

Guidelines:  
- Recommendations must be tailored to the user’s skills, interests, and career goal.  
- Keep each role + reason to ONE LINE only.  
- Avoid generic or repetitive roles across categories unless highly relevant.  
- Be concise, professional, and realistic (not exaggerated).  

User Profile: ${compact}`;
}

function buildSkillGapPromptForRole(answers, role) {
  const resume = (answers.resume_or_link || "").trim();
  const compact = Object.entries(answers).filter(([k]) => k !== 'resume_or_link').map(([k,v]) => `${k}:${v}`).join(" | ");
  let prompt = `You are a concise career skill-gap analyst. Given the user's profile: ${compact}.\n\n`;
  prompt += `Target role: ${role}\n\n`;
  if (resume && resume.toLowerCase() !== 'na') {
    prompt += `The user also provided this resume/GitHub/LinkedIn link or text: ${resume}\n\n`;
  }
  prompt += `Output a short JSON object ONLY (no additional chat) with keys:
{
  "currentSkills": ["skill1","skill2",...],
  "skillsToLearn": ["skillA","skillB",...],
  "matchPercent": 0-100
}
- currentSkills: list the user's existing skills (if available from profile or resume).
- skillsToLearn: list 3 to 5 concrete skills the user should learn to reach the target role.
- matchPercent: integer 0-100 representing how close the user is to the chosen goal (higher = closer).
Keep the JSON compact and valid. If you cannot determine a percent, estimate and provide a number.
Also include (after the JSON) 1-2 short plain sentences to explain the top 2 skills to learn (max 2 lines). Prefer the JSON first.`; 
  return prompt;
}

function buildRoadmapPrompt(answers, role) {
  const compact = Object.entries(answers).map(([k,v]) => `${k}:${v}`).join(" | ");
  return `User profile: ${compact}  
Career goal: ${role}  

Generate a detailed zero-to-hero roadmap in exactly 10 numbered steps to become a ${role}.  

Each step format MUST be:  
Step 1 — [Step Title in bold font]  
What to Learn: [Detailed topic/skill]  
How to Practice: [Actionable steps in bullet points]  
Recommended Resources: [Resource names with links in bullet points].  

Do NOT use any unnecessary stars in your response and Output only the 10 steps, clear, structured, professional.
Example Output (not to be copied, just for format reference):- 
𝐒𝐭𝐞𝐩 𝟏 - 𝐋𝐞𝐚𝐫𝐧 𝐏𝐫𝐨𝐠𝐫𝐚𝐦𝐦𝐢𝐧𝐠 𝐁𝐚𝐬𝐢𝐜𝐬
What to Learn: Variables, Data Types, Control Structures  
How to Practice:
• Build small exercises (calculator, simple scripts)  
Recommended Resources:
• Codecademy "Learn Python"
• geekforgeeks "DSA course".
...continue up to Step 10.
`;
}

function buildDaySimulationPrompt(role) {
  return `
You are an experienced industry professional acting as a mentor.

The user has chosen the role: "${role}"

IMPORTANT:
This is ONLY an ORIENTATION message.
DO NOT give any real tasks yet.

Explain clearly and professionally:

1. What this "Day-in-the-Life Simulation" is
2. How the workday will be structured by time blocks:
   - Morning (9:00–12:00)
   - Short break
   - Lunch
   - Afternoon (12:15–4:00)
3. Explain that:
   - Tasks will be released step-by-step
   - Each task will have a time window
   - Tasks reflect REAL industry work
4. Explain that the user must type DONE to move to the next phase
5. Reassure that this will feel like working with a real professional

End by asking EXACTLY this question:

"Do you want to continue with this role for the simulation, or would you like to change the role?"

Do not include tasks.
Do not simulate the day yet.
`;
}


function buildMorningTaskPrompt(role) {
  return `
You are simulating a real workday for the role: "${role}"

Generate ONLY MORNING TASKS.

Rules:
- Use a professional workflow format
- Use clear time blocks
- Do NOT use stars (*)
- Make headings bold automatically
- Be realistic and industry-level

Format EXACTLY like this:

MORNING WORKFLOW (9:00 AM – 12:00 PM)

9:00 – 10:00  
[Task description]

10:00 – 11:00  
[Task description]

11:00 – 12:00  
[Task description]

Then write:
"Type DONE once you finish the morning tasks to proceed to lunch."

Do not include afternoon tasks.
`;
}

function buildAfternoonTaskPrompt(role) {
  return `
Continue the same workday simulation for the role: "${role}"

Generate AFTERNOON TASKS only.

Rules:
- Continue from lunch break
- Use time blocks
- Be realistic and professional
- No stars (*), no emojis

Format EXACTLY like this:

AFTERNOON WORKFLOW

12:15 – 1:00  
[Task description]

2:00 – 4:00  
[Task description]

END OF DAY OUTCOME  
- What was completed  
- What remains pending  

End with:
"Simulation complete. You can restart or try a new role anytime."
`;
}

const BACKEND_BASE = "https://career-backend-production.up.railway.app";   // <-- make sure your backend runs on 3000

async function callBackendWithPrompt(prompt, extra = {}) {
  const url = `${BACKEND_BASE}/api/groq`; // absolute
  console.log("[frontend] calling", url);

  const body = Object.assign({ prompt }, extra);

  // small helper
  function isTransientServerErrorStatus(status, text) {
    if (!status) return false;
    if (status >= 500) return true;
    // some error responses may return 200 but contain an "overloaded" message in text
    if (typeof text === 'string' && /overload|overloaded|temporar/i.test(text)) return true;
    return false;
  }

  // retry params: try up to 3 total attempts; delay between attempts ~3000ms
  const maxAttempts = 3;
  const retryDelayMs = 3000;
  let lastErr = null;
  let busyBubble = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      
      if (resp.ok) {
        const json = await resp.json().catch(()=>null);
        if (json && typeof json.reply === "string") return json.reply;
        if (json?.candidates?.[0]?.content?.parts?.[0]?.text) return json.candidates[0].content.parts[0].text;
        return JSON.stringify(json);
      }

      // Not OK: read text for diagnosis
      const text = await resp.text().catch(()=>"(no body)");
      console.error("Backend responded", resp.status, text);

      // If server returned a transient server error, show busy bubble on first attempt and retry
      if (isTransientServerErrorStatus(resp.status, text)) {
        lastErr = new Error(`Backend ${resp.status}: ${text}`);
        if (attempt === 1) {
          busyBubble = appendBotHTML(`<div class="text-sm text-gray-700">System is busy — please wait 5–6 seconds, we are retrying automatically...</div>`, { avatar: false });
        } else if (busyBubble) {
          busyBubble.innerHTML = `<div class="text-sm text-gray-700">Retrying... (attempt ${attempt}/${maxAttempts}) — please wait.</div>`;
        }

        // If this was last attempt, break loop and handle below
        if (attempt === maxAttempts) break;

        // wait then retry
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }

      throw new Error(`Backend ${resp.status}: ${text}`);
    } catch (err) {
      // Network or parse error
      lastErr = err;
      console.error("[frontend] callBackendWithPrompt error on attempt", attempt, err);

      // Only show busy bubble for first attempt if it's likely transient
      if (attempt === 1) {
        busyBubble = appendBotHTML(`<div class="text-sm text-gray-700">System is busy — please wait 5–6 seconds, we are retrying automatically...</div>`, { avatar: false });
      } else if (busyBubble) {
        busyBubble.innerHTML = `<div class="text-sm text-gray-700">Retrying... (attempt ${attempt}/${maxAttempts}) — please wait.</div>`;
      }

      if (attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, retryDelayMs));
      continue;
    } finally {
      
    }
  }

  // update final error bubble
  try {
    if (busyBubble && busyBubble.parentNode) {
      busyBubble.innerHTML = `<div class="text-sm text-red-600">Sorry — the system is still busy. Please try again in a few minutes.</div>`;
    }
  } catch (e) { /* ignore */ }

  console.error("callBackendWithPrompt: all attempts failed", lastErr);
  throw lastErr || new Error("Backend request failed");
}

/* ------------------ FLASH chat memory helpers ------------------ */

async function callFlashChat(userMessage) {
  try {
    // append user message to UI immediately
    appendBubble(userMessage, true);

    let hist = [];
    try {
      if (currentUser && currentUser.uid) {
        // Query latest 24 messages (desc), then reverse for chronological order
        const messagesCol = collection(db, "flash_chats", currentUser.uid, "messages");
        const q = query(messagesCol, orderBy("ts", "desc"), limit(24));
        const snaps = await getDocs(q);
        const docs = [];
        snaps.forEach(d => {
          const dt = d.data() || {};
          docs.push({ role: dt.role || "assistant", text: dt.text || "", ts: dt.ts || 0 });
        });
        hist = docs.reverse(); 
      } else {
        // fallback to localStorage method
        hist = loadFlashHistory();
      }
    } catch (e) {
      console.warn("Failed to load history from Firestore, falling back to localStorage:", e);
      try { hist = loadFlashHistory(); } catch(_) { hist = []; }
    }

    hist.push({ role: 'user', text: userMessage, ts: Date.now() });

    const typing = showTypingIndicator(['Thinking...','Preparing quick tips...'], 900);

    // Build a compact prompt from the last few turns (use last 6 turns => ~12 messages)
    const MAX_TURNS = 6;
    const last = hist.slice(-MAX_TURNS * 2); 
    const system =  `System: You are a friendly, concise, expert career consultant for students in India. ` +
                    `Respond in short, helpful, and professional sentences (max 80–100 words). Use bullet points only if necessary. ` +
                    `If a question asks for steps, give 3 quick steps. Avoid long paragraphs. Keep tone encouraging , friendly and 
                     practical to the users based on their questions.`
    let promptBody = system + "\n\nDialogue:\n";
    for (const m of last) {
      if (m.role === 'user') promptBody += `User: ${m.text}\n`;
      else promptBody += `Assistant: ${m.text}\n`;
    }
    // Ensure the API sees the new user message at the end
    if (!promptBody.endsWith("\n")) promptBody += "\n";
    if (!promptBody.endsWith(`User: ${userMessage}\nAssistant:`)) {
      promptBody += `User: ${userMessage}\nAssistant:`;
    }

    // call backend with flash model override 
    const reply = await callBackendWithPrompt(promptBody, { model: 'llama-3.1-8b-instant' });

    removeNode(typing);

    const assistantText = String(reply || '').trim() || "Sorry, I couldn't generate a reply right now.";

    appendBotHTML(`<div class="text-sm">${escapeHtml(assistantText.replace(/\*\*/g, '')).replace(/\n/g, '<br/>')}</div>`);


    // Persist both user message and assistant reply to Firestore 
    try {
      if (currentUser && currentUser.uid) {
        const uid = currentUser.uid;
        // Create deterministic-ish doc ids to avoid collisions
        const tsNow = Date.now();
        const userMsgId = `${tsNow}-u-${Math.random().toString(36).slice(2,8)}`;
        const botMsgId  = `${tsNow + 1}-b-${Math.random().toString(36).slice(2,8)}`;

        // set user message doc
        await setDoc(doc(db, "flash_chats", uid, "messages", userMsgId), {
          role: "user",
          text: userMessage,
          ts: tsNow
        });

        // set assistant message doc
        await setDoc(doc(db, "flash_chats", uid, "messages", botMsgId), {
          role: "assistant",
          text: assistantText,
          ts: tsNow + 1
        });


      } else {
        // fallback: keep localStorage behavior as before
        hist.push({ role: 'assistant', text: assistantText, ts: Date.now() + 1 });
        saveFlashHistory(hist.slice(-24));
      }
    } catch (e) {
      console.warn("Failed to persist flash messages to Firestore:", e);
      // fallback: still save locally to avoid losing history
      try {
        hist.push({ role: 'assistant', text: assistantText, ts: Date.now() + 1 });
        saveFlashHistory(hist.slice(-24));
      } catch (err) { /* ignore */ }
    }

    return assistantText;
  } catch (err) {
    console.error("callFlashChat error:", err);
    appendBotHTML(`<div class="text-sm text-red-600">Sorry — quick chat not available right now.</div>`);
    return null;
  }
}

// ---------- Stage 1: suggestions ----------
async function getCareerSuggestions() {
  const typing = showTypingIndicator([
    '...... ',' Generating response',
    'Finalizing....',' Career Recommendation...'
  ], 1100);

  try {
    const resumeVal = (surveyAnswers.resume_or_link || "").trim();
    if (resumeVal && /^https?:\/\//i.test(resumeVal)) {
      // Ask server to fetch GitHub summary (server returns resumeSummary/ghSummary but not suggestions)
      const resp = await fetch(`${BACKEND_BASE}/api/uploadResume`, {
        method: 'POST',
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ answers: surveyAnswers })
      });

      if (!resp.ok) {
        removeNode(typing);
        const t = await resp.text().catch(()=>"(no body)");
        console.error("uploadResume (url) error:", resp.status, t);
        appendBubble("Sorry — couldn't fetch profile from the link. Please paste profile text or upload resume.", false);
        const prompt = buildSuggestionsPrompt(surveyAnswers);
        const reply = await callBackendWithPrompt(prompt);
        renderSuggestionsAccordion(reply);
        return;
      }

      const j = await resp.json();
      removeNode(typing);

      // store resume summary if present
      if (j?.resumeSummary) {
        surveyAnswers.resumeSummary = j.resumeSummary;
        if (surveyDocRef) {
          try {
            await updateDoc(surveyDocRef, { resumeSummary: j.resumeSummary, updatedAt: new Date(), stage: "suggestions_sent", ai_suggestions: "" }, { merge: true });
            surveyStage = "suggestions_sent";
            updateRoleButtonsState();
          } catch(e) { /* ignore */ }
        }
      }

      // Build client-side prompt including resumeSummary (server didn't return suggestions)
      const prompt = buildSuggestionsPrompt(surveyAnswers) + `\n\nResume summary: ${j.resumeSummary || ""}`;
      const reply = await callBackendWithPrompt(prompt);

      // persist AI suggestions into survey doc
      if (surveyDocRef) {
        try {
          await updateDoc(surveyDocRef, { ai_suggestions: reply, updatedAt: new Date(), stage: "suggestions_sent" });
          surveyStage = "suggestions_sent";
          updateRoleButtonsState();
        } catch(e) { /* ignore */ }
      }

      renderSuggestionsAccordion(reply);
      return;
    }

    // No URL: directly prompt Groq using surveyAnswers 
    const prompt = buildSuggestionsPrompt(surveyAnswers);
    const reply = await callBackendWithPrompt(prompt);
    removeNode(typing);

    if (surveyDocRef) {
      try {
        await updateDoc(surveyDocRef, { stage: "suggestions_sent", ai_suggestions: reply, updatedAt: new Date() });
        surveyStage = "suggestions_sent";
        updateRoleButtonsState();
      } catch(e) { /* ignore */ }
    }

    renderSuggestionsAccordion(reply);
  } catch (err) {
    removeNode(typing);
    console.error("Error calling backend for suggestions:", err);
    appendBubble("Sorry — couldn't get career suggestions right now. Please try again later.");
  }
}

// ---------- Analyze Skill Gap for a chosen role ----------
async function analyzeSkillGapForRole(role) {
  try {
    const resumeSummary = surveyAnswers.resumeSummary || "";
    const resumeVal = (surveyAnswers.resume_or_link || "").trim();
    let reply = null;
    const typing = showTypingIndicator([
      '......','Analyzing resume/profile...',
      'Running skill-gap analysis...'
    ], 1100);

    try {
      if (resumeSummary || (resumeVal && /^https?:\/\//i.test(resumeVal))) {
        const payload = { answers: surveyAnswers, role, resumeSummary: resumeSummary || resumeVal };
        const resp = await fetch(`${BACKEND_BASE}/api/skillGap`, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const t = await resp.text().catch(()=>"(no body)");
          console.error("skillGap backend error:", resp.status, t);
          reply = await callBackendWithPrompt(buildSkillGapPromptForRole(surveyAnswers, role));
        } else {
          const j = await resp.json();
          reply = j?.reply || JSON.stringify(j);
        }
      } else {
        reply = await callBackendWithPrompt(buildSkillGapPromptForRole(surveyAnswers, role));
      }
    } finally {
      removeNode(typing);
    }

    let parsed = null;
    try {
      const jsonTextMatch = String(reply || "").match(/\{[\s\S]*\}/);
      if (jsonTextMatch) {
        parsed = JSON.parse(jsonTextMatch[0]);
      } else {
        parsed = JSON.parse(reply);
      }
    } catch (e) {
      parsed = fallbackParseSkillGap(String(reply || ""));
    }

    const currentSkills = Array.isArray(parsed?.currentSkills) ? parsed.currentSkills : (parsed.currentSkills ? String(parsed.currentSkills).split(',').map(s=>s.trim()) : []);
    const skillsToLearn = Array.isArray(parsed?.skillsToLearn) ? parsed.skillsToLearn : (parsed.skillsToLearn ? String(parsed.skillsToLearn).split(',').map(s=>s.trim()) : []);
    let matchPercent = parseInt(parsed?.matchPercent || parsed?.match || 0, 10);
    if (Number.isNaN(matchPercent)) matchPercent = 0;
    if (!matchPercent) matchPercent = heuristicMatchPercent(currentSkills, skillsToLearn);

    renderSkillGap({
      currentSkills,
      skillsToLearn,
      matchPercent,
      goal: role
    });

    const chatSummary = formatSkillGapChat({ currentSkills, skillsToLearn, matchPercent, goal: role });
    appendBotHTML(`<div class="text-sm">${escapeHtml(chatSummary).replace(/\n/g, '<br/>')}</div>`, { avatar: false });

    if (surveyDocRef) {
      try {
        await updateDoc(surveyDocRef, { skill_gap: { currentSkills, skillsToLearn, matchPercent, goal: role }, updatedAt: new Date() });
        surveyStage = "skill_gap_analyzed";
        updateRoleButtonsState();
      } catch(e) { /* ignore */ }
    }

    // update users doc so Dashboard can show the latest skill gap and current skills
    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userPayload = {};
        if (surveyData.chosenRole) userPayload.goals = surveyData.chosenRole;
        if (surveyData.skill_gap && surveyData.skill_gap.currentSkills) userPayload.skills = surveyData.skill_gap.currentSkills;
        if (surveyAnswers && surveyAnswers.strengths) {
          userPayload.strengths = Array.isArray(surveyAnswers.strengths) ? surveyAnswers.strengths : [surveyAnswers.strengths];
        }
        if (surveyData.skill_gap) userPayload.skill_gap = surveyData.skill_gap;
        if (surveyData.roadmap_text) userPayload.roadmap_text = sanitizeRoadmapText(String(surveyData.roadmap_text));
        if (Object.keys(userPayload).length) {
          userPayload.updatedAt = new Date();
          await updateDoc(userDocRef, userPayload, { merge: true });
        }
      }
    } catch (e) {
      console.warn("Could not update users doc with skill_gap:", e);
    }

    return { currentSkills, skillsToLearn, matchPercent };
  } catch (err) {
    console.error("Error analyzing skill gap for role:", err);
    appendBubble("Skill gap analysis failed. Try again later.", false);
    return null;
  }
}

// fallback parser & helpers 
function fallbackParseSkillGap(text) {
  const out = { currentSkills: [], skillsToLearn: [], matchPercent: 0 };
  try {
    const curMatch = text.match(/current\s*skills[:\-–]\s*([^\n]+)/i);
    const learnMatch = text.match(/skills\s*(to\s*be\s*learned|to learn|to be learned)[:\-–]\s*([^\n]+)/i);
    const percentMatch = text.match(/(\d{1,3})\s*%/);
    if (curMatch) out.currentSkills = curMatch[1].split(/[,;\/]/).map(s=>s.trim()).filter(Boolean);
    if (learnMatch) out.skillsToLearn = learnMatch[2].split(/[,;\/]/).map(s=>s.trim()).filter(Boolean);
    if (percentMatch) out.matchPercent = parseInt(percentMatch[1],10);
  } catch(e){}
  return out;
}

// -------------------- sanitizeRoadmapText helper --------------------
function sanitizeRoadmapText(raw) {
  if (typeof raw !== 'string') return '';
  let s = String(raw || '');

  s = s.replace(/\r/g, '\n');

  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (m, label, url) => `${label} — ${url}`);

  s = s.replace(/<((https?:\/\/)[^>]+)>/gi, '$1');

  s = s.replace(/[\u2013\u2014]/g, '-'); 
  s = s.replace(/\u2022/g, '-');         
  s = s.replace(/[\u2028\u2029]/g, '\n');

  s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');   
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');     

  s = s.replace(/\*{1,}/g, '');

  s = s.split('\n').map(l => l.replace(/\s+$/,'')).join('\n');

  // Keep printable ASCII and common punctuation (avoid breaking jsPDF)
  s = s.replace(/[^\t\n\r\x20-\x7E\u00A0-\u00FF]/g, '');

  return s;
}

function heuristicMatchPercent(current, toLearn) {
  if (!current || !Array.isArray(current)) current = [];
  if (!toLearn || !Array.isArray(toLearn)) toLearn = [];
  if (toLearn.length === 0) return 80;
  const curLower = current.map(s=>s.toLowerCase());
  const matches = toLearn.filter(s => curLower.includes(s.toLowerCase())).length;
  const total = current.length + toLearn.length;
  if (total === 0) return 50;
  const percent = Math.round(100 * (current.length / total));
  return Math.max(10, Math.min(95, percent));
}

function formatSkillGapChat({ currentSkills=[], skillsToLearn=[], matchPercent=0, goal="" }) {
  const topLearn = skillsToLearn.slice(0,3).join(", ") || "No clear missing skills identified.";
  const line1 = `Skill gap for ${goal} — Key skills to learn: ${topLearn}.`;
  const line2 = `Estimated fit: ${matchPercent}% match. Focus on the top 2 skills to close the gap quickly.`;
  return `${line1}\n${line2}`;
}

function renderSkillGap({ currentSkills = [], skillsToLearn = [], matchPercent = 0, goal = "" }) {
  const allCards = document.querySelectorAll('.animated-border');
  let skillCard = null;
  for (const c of allCards) {
    if (c.innerText && c.innerText.toLowerCase().includes('skill gap analyzer')) {
      skillCard = c;
      break;
    }
  }
  if (!skillCard) {
    console.warn("Skill Gap card not found in DOM");
    return;
  }

  const percent = Math.max(0, Math.min(100, Number(matchPercent || 0)));
  const html = `
    <div class="card-content">
      <div class="px-4 py-3 border-b border-[#f3e8e3]">
        <h3 class="font-semibold">Skill Gap Analyzer</h3>
      </div>
      <!-- ✅ Added Tailwind scroll + fixed height here -->
      <div class="p-4 space-y-3 max-h-48 overflow-y-auto">
        <div class="flex items-center gap-3">
          <div class="relative h-14 w-14 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 36 36" class="absolute inset-0 h-14 w-14">
              <path d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32" fill="none" stroke="#f3e8e3" stroke-width="4" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#eac9c1" stroke-width="4"
                stroke-dasharray="${(percent/100)*88}, 88" stroke-linecap="round" transform="rotate(-90 18 18)"></circle>
            </svg>
            <div style="z-index:2;position:relative;text-align:center;">
              <div style="font-size:12px;color:#c36b5a;font-weight:700">${percent}%</div>
            </div>
          </div>
          <p class="text-sm"><span class="font-semibold text-[#bc7e6a]">You are ${100 - percent}% away</span> from your dream job.</p>
        </div>

        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="col-span-1 text-[#6b5b55]">Your Current Skills:</div>
          <div class="col-span-2">${escapeHtml(currentSkills.join(', ') || '—')}</div>

          <div class="col-span-1 text-[#6b5b55]">Skills To Be Learned:</div>
          <div class="col-span-2">${escapeHtml(skillsToLearn.join(', ') || '—')}</div>

          <div class="col-span-1 text-[#6b5b55]">Your Goal:</div>
          <div class="col-span-2 font-medium text-[#bc7e6a]">${escapeHtml(goal || '—')}</div>
        </div>
      </div>
    </div>
  `;
  skillCard.innerHTML = html;
}

// ---------- Roadmap flow -------------
async function requestRoadmapForRole(role) {
  appendBubble(role, true);
    if (surveyDocRef) {
    try {
      // persist user's chosen role
      await updateDoc(surveyDocRef, { chosenRole: role, updatedAt: new Date() });
      surveyChosenRole = role;          
      surveyAnswers.chosenRole = role;
      updateRoleButtonsState();        
    } catch(e){
      console.warn("Could not persist chosenRole to Firestore:", e);
      surveyChosenRole = role;
      updateRoleButtonsState();
    }
  }

  const gapResult = await analyzeSkillGapForRole(role);

  const typing = showTypingIndicator([
    '......',
    'Drafting roadmap...',
    'Finalizing roadmap PDF...'
  ], 1100);

  try {
    const prompt = buildRoadmapPrompt(surveyAnswers, role);
    const reply = await callBackendWithPrompt(prompt);
    removeNode(typing);

    // sanitize roadmap text before storing/rendering
    const sanitizedRoadmap = sanitizeRoadmapText(String(reply || '')).trim();

    if (surveyDocRef) {
      try {
        await updateDoc(surveyDocRef, { roadmap_text: sanitizedRoadmap, stage: "roadmap_generated", updatedAt: new Date() });
        surveyStage = "roadmap_generated";
        updateRoleButtonsState();
      } catch(e) { /* ignore */ }
    }

    // Push roadmap + chosenRole into the users doc so that Dashboard can pick it up
    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          goals: role || "",
          roadmap_text: sanitizedRoadmap,
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Could not update users doc with roadmap:", e);
    }

    appendBubble("Your Roadmap is generated in the right side.", false);
    renderRoadmapPanel(sanitizedRoadmap);
    await createRoadmapPDF(sanitizedRoadmap, role);
  } catch (err) {
    removeNode(typing);
    console.error("Error requesting roadmap:", err);
    appendBubble("Error retrieving roadmap. Please try again later.");
  }
}

// --------------- renderRoadmapPanel --------------
function renderRoadmapPanel(text) {
  const roadmapEmpty = document.getElementById('roadmapEmpty');
  const roadmapList = document.getElementById('roadmapList');

  const targetContainer = roadmapEmpty || roadmapList;
  if (!targetContainer) return;
  if (roadmapList) {
    roadmapList.innerHTML = '';
    roadmapList.classList.add('hidden');
  }
  if (roadmapEmpty) {
    roadmapEmpty.classList.add('hidden');
  }

  let pdfArea = targetContainer.parentNode.querySelector('.roadmap-pdf-area');
  if (!pdfArea) {
    pdfArea = document.createElement('div');
    pdfArea.className = 'roadmap-pdf-area';
    pdfArea.style.padding = '1rem';
    pdfArea.style.background = 'transparent';
    pdfArea.style.borderTop = '1px solid #f3e8e3';
    pdfArea.style.marginTop = '0.75rem';
    pdfArea.style.borderRadius = '0 0 0.5rem 0.5rem';
    targetContainer.parentNode.appendChild(pdfArea);
  } else {
    pdfArea.innerHTML = '';
  }

  pdfArea.innerHTML = `
    <div class="font-medium text-sm">Your roadmap is generated in a downloadable link below</div>
    <div id="roadmapPdfLink" class="mt-2 rounded-lg"></div>
  `;
}


// helper to clear the roadmap PDF area 
function clearRoadmapPdfArea() {
  const roadmapEmpty = document.getElementById('roadmapEmpty');
  const roadmapList = document.getElementById('roadmapList');
  const targetParent = (roadmapEmpty || roadmapList)?.parentNode;
  if (!targetParent) return;

  const pdfArea = targetParent.querySelector('.roadmap-pdf-area');
  if (pdfArea) {
    const linkDiv = pdfArea.querySelector('#roadmapPdfLink');
    if (linkDiv && linkDiv.dataset && linkDiv.dataset.blobUrl) {
      try { URL.revokeObjectURL(linkDiv.dataset.blobUrl); } catch(e){/*ignore*/}
    }
    pdfArea.remove();
  }

  if (roadmapList) {
    roadmapList.innerHTML = '';
    roadmapList.classList.add('hidden');
  }
  if (roadmapEmpty) {
    roadmapEmpty.classList.remove('hidden');
  }
}

async function createRoadmapPDF(text, role = '') {
  try {
    renderRoadmapPanel(text);

    const jspdfGlobal = window.jspdf || (window.jspdf && window.jspdf.default) || null;
    if (!jspdfGlobal && !window.jsPDF && !window.jspdf?.jsPDF) {
      console.warn("jsPDF not found. Include jsPDF UMD in your HTML to enable PDF download.");
      const linkDivFallback = document.getElementById('roadmapPdfLink');
      if (linkDivFallback) {
        linkDivFallback.innerHTML = `<div class="text-xs text-[#6b5b55]">PDF generation not available. (Include jsPDF library to enable.)</div>`;
      }
      return;
    }

    const jsPDFConstructor = (jspdfGlobal && (jspdfGlobal.jsPDF || jspdfGlobal.default || jspdfGlobal)) || (window.jsPDF || window.jspdf?.jsPDF);
    if (!jsPDFConstructor) {
      console.warn("Couldn't locate jsPDF constructor.");
      const linkDivFallback2 = document.getElementById('roadmapPdfLink');
      if (linkDivFallback2) {
        linkDivFallback2.innerHTML = `<div class="text-xs text-[#6b5b55]">PDF generation not available. (Include jsPDF library to enable.)</div>`;
      }
      return;
    }

    // Using safe/sanitized role for the title
    const chosenRoleRaw = (role && String(role).trim()) || (surveyAnswers && surveyAnswers.chosenRole) || "";
    const safeRole = String(chosenRoleRaw).replace(/[^\x20-\x7E]/g, '').trim();

    // Basic normalize: replace long dashes and bullets with ASCII equivalents, strip non-ASCII
    let normalized = String(text || '');
    normalized = normalized.replace(/\r/g, '')
                           .replace(/[\u2013\u2014]/g, '-')   
                           .replace(/\u2022/g, '-')          
                           .replace(/[\u2018\u2019]/g, "'")    
                           .replace(/[\u201C\u201D]/g, '"')    
                           
     normalized = normalized.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (m, label, url) => {
     return `${label} — ${url}`;
       });                      
     normalized = normalized.replace(/\*{1,3}/g, '');
     normalized = normalized.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ''); 

    const title = safeRole ? `Personal Roadmap for ${safeRole}` : "Personal Roadmap for Shaping your future";

    const doc = new jsPDFConstructor({ unit: 'pt', format: 'a4' });

    // page metrics & margins
    const pageWidth = (doc.internal.pageSize && (doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width)) || 595.28;
    const pageHeight = (doc.internal.pageSize && (doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height)) || 841.89;
    const marginLeft = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const topMargin = 60;
    const bottomLimit = pageHeight - 60;
    let y = topMargin;

    // Title 
    try { doc.setFont('helvetica', 'bold'); } catch (e) { /* ignore if not supported */ }
    doc.setFontSize(20);
    try {
      const tw = (doc.getTextWidth && doc.getTextWidth(title)) || (doc.getStringUnitWidth ? doc.getStringUnitWidth(title) * doc.internal.getFontSize() : null);
      if (typeof tw === 'number') {
        const x = Math.max(marginLeft, (pageWidth - tw) / 2);
        doc.text(title, x, y);
      } else {
        doc.text(title, marginLeft, y);
      }
    } catch (e) {
      doc.text(title, marginLeft, y);
    }

    y += 18;
    try { doc.setDrawColor(211, 171, 158); doc.setLineWidth(0.8); } catch(e){}
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 18;

    const lines = normalized.split('\n');
    const steps = [];
    let current = null;
    const prelude = [];

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (current) current.body.push('');
        else prelude.push('');
        continue;
      }
      const headerMatch = line.match(/^Step\s*(\d+)\s*[-:]\s*(.+)$/i);
      if (headerMatch) {
        if (current) steps.push(current);
        current = { num: Number(headerMatch[1]), title: headerMatch[2].trim(), body: [] };
      } else {
        if (current) current.body.push(line);
        else prelude.push(line);
      }
    }
    if (current) steps.push(current);

    const lineHeight = 14;

    function ensureSpace(needed) {
      if (y + needed > bottomLimit) {
        doc.addPage();
        y = topMargin;
      }
    }

    if (prelude.length) {
      try { doc.setFont('helvetica', 'normal'); } catch(e){}
      doc.setFontSize(11);
      const preText = prelude.join(' ').trim();
      if (preText) {
        const wrapped = doc.splitTextToSize(preText, contentWidth);
        ensureSpace(wrapped.length * lineHeight + 6);
        doc.text(wrapped, marginLeft, y);
        y += wrapped.length * lineHeight + 10;
      }
    }

    for (const s of steps) {
      try { doc.setFont('helvetica', 'bold'); } catch(e){}
      doc.setFontSize(13);
      const stepHeading = `Step ${s.num} — ${s.title}`;
      const headingWrapped = doc.splitTextToSize(stepHeading, contentWidth);
      ensureSpace(headingWrapped.length * lineHeight + 6);
      doc.text(headingWrapped, marginLeft, y);
      y += headingWrapped.length * lineHeight + 6;

      // Step body
      if (s.body && s.body.length) {
        try { doc.setFont('helvetica', 'normal'); } catch(e){}
        doc.setFontSize(11);
        for (let bodyLine of s.body) {
          if (!bodyLine.trim()) { y += 6; continue; }

          // If line starts with "-" treat as bullet/indented list
          const isBullet = /^[\-\*]\s+/.test(bodyLine);
          if (isBullet) {
            const content = bodyLine.replace(/^[\-\*]\s+/, '').trim();
            const wrapped = doc.splitTextToSize(content, contentWidth - 18);
            ensureSpace(wrapped.length * lineHeight + 6);
            doc.text('-', marginLeft + 6, y);
            doc.text(wrapped, marginLeft + 18, y);
            y += wrapped.length * lineHeight + 6;
          } else {
            const wrapped = doc.splitTextToSize(bodyLine, contentWidth);
            ensureSpace(wrapped.length * lineHeight + 6);
            doc.text(wrapped, marginLeft + 6, y);
            y += wrapped.length * lineHeight + 6;
          }
        }
      }
      y += 8;
    }

    // Fallback: if no steps found, render the entire normalized text in plain style
    if (steps.length === 0) {
      try { doc.setFont('helvetica', 'normal'); } catch(e){}
      doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(normalized, contentWidth);
      ensureSpace(wrapped.length * lineHeight + 6);
      doc.text(wrapped, marginLeft, y);
      y += wrapped.length * lineHeight + 6;
    }

    // produce blob & link
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    let linkDiv = document.getElementById('roadmapPdfLink');
    if (!linkDiv) {
      renderRoadmapPanel(text);
      linkDiv = document.getElementById('roadmapPdfLink');
    }
    if (!linkDiv) {
      console.warn("Unable to locate roadmapPdfLink to insert PDF link.");
      return;
    }

    const prevUrl = linkDiv.dataset?.blobUrl;
    if (prevUrl) {
      try { URL.revokeObjectURL(prevUrl); } catch (e) { /* ignore */ }
    }

    linkDiv.innerHTML = `<a href="${url}" download="roadmap.pdf" class="inline-flex items-center gap-2 rounded px-3 py-2 bg-[#d3ab9e] text-white text-sm">Download Roadmap PDF</a>`;
    linkDiv.dataset.blobUrl = url;

  } catch (err) {
    console.error("PDF generation error:", err);
    const linkDiv = document.getElementById('roadmapPdfLink');
    if (linkDiv) {
      linkDiv.innerHTML = `<div class="text-xs text-red-600">Error generating PDF. Try again later.</div>`;
    }
  }
}


// ---------- helper escapeHtml ----------
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}

// ---------- composer/send behavior ----------
sendBtn?.addEventListener('click', async () => {
  const v = composer.value.trim();
  if (!v) return;

  if (surveyActive) {
    handleAnswer(v);
    composer.value = '';
    return;
  }

  // ---------- Simulation Chat Intercept ----------
// ---------- Simulation Chat Intercept ----------
if (simulationActive) {
  const msg = v.toLowerCase();
  composer.value = '';

  // 1️⃣ User agrees after orientation
  if (
    simulationStage === "await_confirmation" &&
    (msg.includes("yes") || msg.includes("continue"))
  ) {
    simulationStage = "morning_tasks";
    appendBubble("Yes, continue with this role.", true);

    const typing = showTypingIndicator(
      ['Preparing morning workflow...', 'Assigning real tasks...'],
      1000
    );

    try {
      const reply = await callBackendWithPrompt(
        buildMorningTaskPrompt(simulationRole)
      );
      removeNode(typing);

      appendBotHTML(
        `<div class="text-sm">${escapeHtml(reply).replace(/\n/g, '<br/>')}</div>`
      );

      simulationStage = "await_morning_done";
      return;
    } catch (e) {
      removeNode(typing);
      appendBotHTML(`<div class="text-sm text-red-600">Failed to generate morning tasks.</div>`);
      return;
    }
  }

  // 2️⃣ Morning tasks completed
  if (
    simulationStage === "await_morning_done" &&
    msg.includes("done")
  ) {
    simulationStage = "afternoon_tasks";
    appendBubble("DONE", true);

    const typing = showTypingIndicator(
      ['Preparing afternoon tasks...', 'Continuing workday...'],
      1000
    );

    try {
      const reply = await callBackendWithPrompt(
        buildAfternoonTaskPrompt(simulationRole)
      );
      removeNode(typing);

      appendBotHTML(
        `<div class="text-sm">${escapeHtml(reply).replace(/\n/g, '<br/>')}</div>`
      );

      simulationStage = "completed";
      return;
    } catch (e) {
      removeNode(typing);
      appendBotHTML(`<div class="text-sm text-red-600">Failed to generate afternoon tasks.</div>`);
      return;
    }
  }

  // 3️⃣ Change role at any point
  if (msg.includes("change")) {
    simulationStage = "intro";
    appendBubble("I want to change the role.", true);
    appendBotHTML(`<div class="text-sm">Please type the new role you want to simulate.</div>`);
    return;
  }

  // 4️⃣ New role entered
  if (simulationStage === "intro") {
    simulationRole = v.trim();
    appendBubble(simulationRole, true);

    const typing = showTypingIndicator(
      ['Setting up new simulation...', 'Preparing orientation...'],
      1000
    );

    try {
      const reply = await callBackendWithPrompt(
        buildDaySimulationPrompt(simulationRole)
      );
      removeNode(typing);

      appendBotHTML(
        `<div class="text-sm">${escapeHtml(reply).replace(/\n/g, '<br/>')}</div>`
      );

      simulationStage = "await_confirmation";
      return;
    } catch (e) {
      removeNode(typing);
      appendBotHTML(`<div class="text-sm text-red-600">Simulation failed.</div>`);
      return;
    }
  }
}

// ---------- Default chat ----------
composer.value = '';
try {
  await callFlashChat(v);
} catch (e) {
  console.error("sendBtn flash chat error:", e);
  appendBotHTML('<div class="text-sm text-red-600">Oops — chat failed.</div>');
}

});

composer?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// ---------- Day-in-the-Life Simulator Button ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.textContent.trim() === "Start Your Experience") {
    if (!surveyChosenRole) {
      appendBotHTML(
        `<div class="text-sm text-red-600">Please complete the survey and choose a role first.</div>`,
        { avatar: false }
      );
      return;
    }

    simulationActive = true;
    simulationRole = surveyChosenRole;
    simulationStage = "intro";

    appendBubble(
      `Start a one-day work simulation for the role: ${simulationRole}`,
      true
    );

    const typing = showTypingIndicator(
      ['Preparing real-world simulation...', 'Analyzing industry workflow...'],
      1000
    );

    try {
      const reply = await callBackendWithPrompt(
        buildDaySimulationPrompt(simulationRole)
      );
      removeNode(typing);

      appendBotHTML(
        `<div class="text-sm">${escapeHtml(reply).replace(/\n/g, '<br/>')}</div>`
      );

      simulationStage = "await_confirmation";
    } catch (err) {
      removeNode(typing);
      appendBotHTML(
        `<div class="text-sm text-red-600">Failed to start simulation. Try again.</div>`
      );
    }
  }
});


// ---------- Start / initialization (intro rendering + retake UI) ----------
function renderIntroInitial() {
  const intro = document.getElementById('surveyIntro');
  if (!intro) return;

  const name = currentUser ? (currentUser.displayName || currentUser.email || "User") : "[UserName]";

  intro.innerHTML = `
    <div class="rounded-xl bg-white border border-[#f3e8e3] p-4 text-center">
      <p class="font-semibold text-lg">Hi <span id="caUser">${escapeHtml(name)}</span>, 👋</p>
      <p class="text-sm text-[#6b5b55] mt-1">Let’s Build Your Path Towards Your Dream Job!</p>
      <button id="startSurvey" type="button"
        class="mt-3 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold bg-[#d3ab9e] hover:bg-[#bc7e6a] text-white shadow-glow transition">
        Start Your Survey
      </button>
    </div>
  `;

  const newStart = document.getElementById('startSurvey');
  newStart?.addEventListener('click', onStartClick);

  intro.classList.remove('opacity-0', 'pointer-events-none');
}

function renderIntroRetake() {
  const intro = document.getElementById('surveyIntro');
  if (!intro) return;
  intro.innerHTML = `
    <div class="rounded-xl bg-white border border-[#f3e8e3] p-4 text-center flex items-center justify-between gap-3">
      <div class="text-left">
        <p class="font-semibold text-lg">Survey in progress</p>
        <p class="text-sm text-[#6b5b55] mt-1">You can retake your survey anytime to update your results.</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="retakeBtn" title="Retake survey" class="inline-flex items-center justify-center rounded-full p-2 bg-white border border-[#f3e8e3] hover:bg-[#f7f0ec]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 768 768" fill="#C98B7A" aria-hidden="true">
          <path d="M597 528c-41 64-112 107-193 107-126 0-228-102-228-228S278 179 404 179c67 0 128 30 170 77l-53 53c-28-31-68-50-117-50-91 0-166 75-166 166s75 166 166 166c56 0 103-28 133-70l-63-1 0-72 160 0 0 160-72 0z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  const retakeBtn = document.getElementById('retakeBtn');
  retakeBtn?.addEventListener('click', onRetakeClick);
  intro.classList.remove('opacity-0', 'pointer-events-none');
}

function clearChat() {
  const chatScroll = document.getElementById('chatScroll');
  if (!chatScroll) return;
  while (chatScroll.firstChild) chatScroll.removeChild(chatScroll.firstChild);
  persistedSurveyBubble = null;
}

async function onStartClick(e) {
  if (!currentUser) {
    alert("Please log in first to continue the survey.");
    localStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
    window.location.href = "./login.html";
    return;
  }

  await createSurveyDoc();

  renderIntroRetake();
  startSurvey();
}

function startSurvey() {
  const introContent = document.getElementById('surveyIntro');
  if (introContent) {
    introContent.classList.add('opacity-0', 'pointer-events-none', 'transition-opacity', 'duration-300');
    setTimeout(() => {
      introContent.classList.remove('opacity-0', 'pointer-events-none');
    }, 350);
  }

  surveyIndex = 0;
  surveyAnswers = {};
  surveyActive = true;
  appendBubble("Hi — I’m CareerAssistBot. I'll ask a few quick questions to personalize your career suggestions. Use the suggestion buttons or type your answer.", false);
  setTimeout(() => showNextQuestion(), 800);
}

// ------------------ Attachments / speech code ------------------
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
let fileInput = document.getElementById('fileInput'); 

// Speech recognition 
let recognition = null;
let recognizing = false;
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.lang = 'en-US';
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

if (micBtn) {
  recognition = initSpeechRecognition();
  if (!recognition) {
    micBtn.title = "Voice not supported in this browser";
    micBtn.classList.add('opacity-60');
  } else {
    let finalTranscript = "";
    recognition.onstart = () => {
      recognizing = true;
      micBtn.classList.add('ring-2','ring-[#d3ab9e]');
    };
    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove('ring-2','ring-[#d3ab9e]');
    };
    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      recognizing = false;
      micBtn.classList.remove('ring-2','ring-[#d3ab9e]');
    };
    recognition.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        if (ev.results[i].isFinal) {
          finalTranscript += ev.results[i][0].transcript;
        } else {
          interim += ev.results[i][0].transcript;
        }
      }
      composer.value = (finalTranscript + interim).trim();
    };

    micBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!recognition) return;
      if (recognizing) recognition.stop();
      else {
        finalTranscript = "";
        composer.value = "";
        try { recognition.start(); } catch(err) { console.error("recognition.start() error:", err); }
      }
    });
  }
}

// File attach flow 
attachBtn?.addEventListener('click', (e) => {
  e.preventDefault();

  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  inp.style.display = 'none';
  document.body.appendChild(inp);

  const cleanupInput = () => {
    try { if (inp && inp.parentNode) inp.parentNode.removeChild(inp); } catch(e) {}
  };

  inp.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) { cleanupInput(); return; }

    files.forEach(file => {
      const reader = new FileReader();
      const bubble = document.createElement('div');
      bubble.className = 'attachment-bubble relative rounded-xl p-3 border border-[#f3e8e3] bg-white max-w-[70%]';
      bubble.style.display = 'inline-block';
      bubble.style.marginBottom = '8px';

      bubble.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="thumb" style="width:56px;height:56px;flex:0 0 56px;border-radius:8px;overflow:hidden;background:#fafafa;display:flex;align-items:center;justify-content:center;border:1px solid #eee"></div>
          <div style="flex:1">
            <div class="fname" style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file.name)}</div>
            <div class="fmeta" style="font-size:12px;color:#666">${Math.round(file.size/1024)} KB • ${escapeHtml(file.type || 'file')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="send-attach inline-flex items-center justify-center rounded px-3 py-1 bg-[#d3ab9e] text-white text-xs">Send to AI</button>
            <button class="remove-attach inline-flex items-center justify-center rounded px-3 py-1 border border-[#eee] bg-white text-xs">Remove</button>
          </div>
        </div>
      `;

      chatScroll.appendChild(bubble);
      chatScroll.scrollTop = chatScroll.scrollHeight;

      reader.onload = (rEv) => {
        const thumb = bubble.querySelector('.thumb');
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = rEv.target.result;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.objectFit = 'cover';
          thumb.appendChild(img);
        } else {
          thumb.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c5bcb9" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
        }
        bubble._dataURL = rEv.target.result; 
      };
      reader.readAsDataURL(file);

      const removeBtn = bubble.querySelector('.remove-attach');
      removeBtn.addEventListener('click', () => {
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
      });

      const sendBtnAttach = bubble.querySelector('.send-attach');
      sendBtnAttach.addEventListener('click', async () => {
        appendBubble(`Sent file: ${file.name}`, true);
        sendBtnAttach.disabled = true;
        sendBtnAttach.textContent = "Sending...";

        const lastQuestionIndex = surveyQuestions.length - 1;
        const isLastQuestion = surveyActive && surveyIndex === lastQuestionIndex;

        try {
          if (isLastQuestion) {
            const lastKey = surveyQuestions[lastQuestionIndex].key || 'resume';
            surveyAnswers[lastKey] = file.name;
            await saveAnswerToFirestore(lastKey, file.name);

            // POST file to backend for resume extraction
            const payload = { filename: file.name, mime: file.type, dataURL: bubble._dataURL, answers: surveyAnswers };
            const resp = await fetch(`${BACKEND_BASE}/api/uploadResume`, {
              method: 'POST',
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify(payload)
            });

            if (!resp.ok) {
              const t = await resp.text().catch(()=>"(no body)");
              console.error("uploadResume error:", resp.status, t);
              appendBubble("Sorry — couldn't analyze the resume right now. Please try again.", false);
            } else {
              const j = await resp.json();
              // store resume summary if present
              if (j?.resumeSummary) {
                surveyAnswers.resumeSummary = j.resumeSummary;
                if (surveyDocRef) {
                  try { await updateDoc(surveyDocRef, { resumeSummary: j.resumeSummary, updatedAt: new Date() });
                } catch(e){/*ignore*/ }
                }
              }

              // Frontend builds suggestion prompt (with resumeSummary) and calls /api/gemini
              const prompt = buildSuggestionsPrompt(surveyAnswers) + `\n\nResume summary: ${j.resumeSummary || ""}`;
              try {
                const reply = await callBackendWithPrompt(prompt);
                // persist ai suggestions
                if (surveyDocRef) {
                  try { await updateDoc(surveyDocRef, { ai_suggestions: reply, updatedAt: new Date(), stage: "suggestions_sent" });
                  surveyStage = "suggestions_sent";
                  updateRoleButtonsState();
                  } catch(e){/*ignore*/ }
                }
                renderSuggestionsAccordion(String(reply || ""));
              } catch (err) {
                console.error("Error getting suggestions from backend after upload:", err);
                appendBubble("Sorry — couldn't get career suggestions right now. Please try again later.", false);
              }
            }
          } else {
            const attachments = [{ name: file.name, type: file.type, dataURL: bubble._dataURL }];
            const prompt = `User uploaded file(s). Filename: ${file.name}. Filetype: ${file.type}. Use the content to help with the conversation or analysis as appropriate. If image, describe or extract relevant info.`;
            const resp = await fetch(`${BACKEND_BASE}/api/groq`, {
              method: 'POST',
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, attachments })
            });

            if (!resp.ok) {
              const txt = await resp.text().catch(()=>"(no body)");
              console.error("Attachment backend error:", resp.status, txt);
              appendBubble("Sorry — couldn't process the attachment right now.", false);
            } else {
              const j = await resp.json();
              const reply = (typeof j.reply === 'string') ? j.reply : (j?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(j));
              appendBotHTML(`<div class="text-sm">${escapeHtml(String(reply || "No reply")).replace(/\n/g, '<br/>')}</div>`, { avatar: false });
            }
          }
        } catch (err) {
          console.error("Attachment send error:", err);
          appendBubble("Error sending attachment to backend.", false);
        } finally {
          if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        }
      });
    }); 
    cleanupInput();
  }); 

  inp.click();
});

// ------------------ Toast slide-in UI for Retake confirmation ------------------
function showRetakeToast(message, onConfirm) {
  if (document.getElementById('retakeToast')) return;

  const toast = document.createElement('div');
  toast.id = 'retakeToast';
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    left: '-420px',
    width: '380px',
    zIndex: '9999',
    background: 'rgba(253, 247, 242, 0.95)',
    color: '#050100',
    padding: '14px',
    borderRadius: '8px',
    boxShadow: '0 8px 30px rgba(217, 125, 95,0.25)',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    transition: 'transform 300ms ease, left 300ms ease, opacity 300ms ease',
    transform: 'translateX(0)',
    opacity: '0'
  });

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.fontSize = '14px';
  content.innerText = message;

  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.gap = '8px';

  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  Object.assign(okBtn.style, {
    background: '#d3ab9e',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600'
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    background: 'transparent',
    color: '#050100',
    border: '2px solid rgba(181, 94, 65,0.9)',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer'
  });

  btnWrap.appendChild(okBtn);
  btnWrap.appendChild(cancelBtn);
  toast.appendChild(content);
  toast.appendChild(btnWrap);
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.left = '20px';
    toast.style.opacity = '1';
  });

  function cleanup() {
    toast.style.left = '-420px';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 320);
  }

  okBtn.addEventListener('click', () => {
    cleanup();
    try { if (typeof onConfirm === 'function') onConfirm(); } catch(e){ console.error(e); }
  });

  cancelBtn.addEventListener('click', () => {
    cleanup();
  });

  const keyHandler = (ev) => {
    if (ev.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

// helper to reset skill gap card to its default placeholder state
function resetSkillGapCard() {
  const allCards = document.querySelectorAll('.animated-border');
  let skillCard = null;
  for (const c of allCards) {
    if (c.innerText && c.innerText.toLowerCase().includes('skill gap analyzer')) {
      skillCard = c;
      break;
    }
  }
  if (!skillCard) return;
  const placeholder = `
    <div class="card-content">
      <div class="px-4 py-3 border-b border-[#f3e8e3]">
        <h3 class="font-semibold">Skill Gap Analyzer</h3>
      </div>
      <div class="p-4 space-y-3">
        <div class="flex items-center gap-3">
          <div class="relative h-14 w-14 rounded-full bg-[#f7f0ec]">
            <svg viewBox="0 0 36 36" class="absolute inset-0">
              <path d="M18 2 a 16 16 0 1 1 0 32 a 16 16 0 1 1 0 -32"
                    fill="none" stroke="#eac9c1" stroke-width="4" stroke-dasharray="65,100" stroke-linecap="round"/>
            </svg>
          </div>
          <p class="text-sm"><span class="font-semibold text-[#bc7e6a]">You are 50% away</span> from your dream job.</p>
        </div>

        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="col-span-1 text-[#6b5b55]">Your Current Skills:</div>
          <div class="col-span-2">Beginner Python, Spreadsheets, SQL</div>

          <div class="col-span-1 text-[#6b5b55]">Skills To Be Learned:</div>
          <div class="col-span-2">Advanced Python, Data Analysis, Statistics</div>

          <div class="col-span-1 text-[#6b5b55]">Your Goal:</div>
          <div class="col-span-2 font-medium text-[#bc7e6a]">Data Scientist</div>
        </div>
      </div>
    </div>
  `;
  skillCard.innerHTML = placeholder;
}

// handle retake click
async function onRetakeClick(e) {
  showRetakeToast("Retake survey? This will clear your current chat and allow you to start again.", async () => {
    clearChat();
    surveyIndex = 0;
    surveyAnswers = {};
    surveyActive = false;

    if (currentUser) {
      const docRef = doc(db, "surveys", currentUser.uid);
      // Set answers empty and clear AI outputs
      await setDoc(docRef, {
        answers: {},
        stage: "in_progress",
        chosenRole: "", 
        updatedAt: new Date(),
        ai_suggestions: "",
        skill_gap: null,
        roadmap_text: ""
      }, { merge: true });
      surveyDocRef = docRef;
      surveyStage = "in_progress";
      surveyChosenRole = null;
      surveyAnswers.chosenRole = "";
      updateRoleButtonsState();
    } else {
      surveyDocRef = null;
      surveyStage = null;
      surveyChosenRole = null;
    }

    clearRoadmapPdfArea();
    resetSkillGapCard();
    renderIntroInitial();
    const chatScrollEl = document.getElementById('chatScroll');
    if (chatScrollEl) chatScrollEl.scrollTop = 0;
  });
}


// ---------- Render suggestions and attach role handlers ----------
function createButtonSpinner() {
  return `<svg class="inline-block h-4 w-4 align-middle mr-2" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M43.935,25.145c0-10.318-8.352-18.67-18.67-18.67c-10.319,0-18.672,8.352-18.672,18.67h4.068 c0-8.048,6.556-14.604,14.604-14.604c8.049,0,14.605,6.556,14.605,14.604H43.935z"><animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"/></path></svg>`;
}


function renderSuggestionsAccordion(replyText) {
  appendBotHTML(`<div class="text-sm mb-2">Here are some career suggestions. Tap a role to see a short roadmap:</div>`, { avatar: false });

  const lines = replyText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const sections = {};
  let currentHeader = "Suggestions";

  lines.forEach(l => {
    const cleaned = l.replace(/^\**\d*\.?\s*\**/, "").trim();
    const headerMatch = cleaned.match(/^(?:▼\s*)?(Current( Job)? Market|Present( Job)? Market|Today'?s( Job)? Market|Existing( Job)? Market|Market Right Now|Local (Opportunities|Job Market|Jobs|Career Options)|Job (Opportunities|Options) (in|around|near|for) (User'?s|Your) (Location|Area|Region)|Regional Job Market|Opportunities Near You|Future( Job)? Market|Upcoming( Job)? Market|Emerging( Job)? Market|Jobs in the Future|Market Trends Ahead|Tomorrow'?s( Job)? Market)/i);

    if (headerMatch) {
      currentHeader = headerMatch[1];
      sections[currentHeader] = [];
      return;
    }

    const bulletMatch = cleaned.match(/^[\-•]\s*(.+)$/);
    if (bulletMatch) {
      sections[currentHeader] = sections[currentHeader] || [];
      sections[currentHeader].push(bulletMatch[1]);
      return;
    }

    const split = cleaned.split(/\s+[—\-–:]\s+/);
    if (split.length >= 2) {
      sections[currentHeader] = sections[currentHeader] || [];
      sections[currentHeader].push(`${split[0].trim()} — ${split.slice(1).join(' - ').trim()}`);
    } else {
      sections[currentHeader] = sections[currentHeader] || [];
      sections[currentHeader].push(cleaned);
    }
  });

  if (Object.keys(sections).length === 0) {
    appendBotHTML(`<div class="text-sm">${escapeHtml(replyText).replace(/\n/g, '<br/>')}</div>`, { avatar: false });
    return;
  }

  const hasChosenRole = Boolean(surveyChosenRole);

  Object.keys(sections).forEach(sectionName => {
    const items = (sections[sectionName] || []).slice(0, 3);
    const card = document.createElement('div');
    card.className = 'accordion-card';
    card.innerHTML = `
      <div class="accordion-header">
        <div class="font-medium text-sm">${escapeHtml(sectionName)}</div>
        <div class="text-xs text-gray-500">▼</div>
      </div>
      <div class="accordion-body">
        ${items.map(it => {
          const parts = it.split(/\s+[—\-–:]\s+/);
          const role = escapeHtml(parts[0].trim());
          const expl = parts[1] ? escapeHtml(parts.slice(1).join(' - ').trim()) : "";
          if (hasChosenRole) {
            return `<div class="py-2"><div class="flex items-center justify-between"><div class="text-sm font-medium">${role}</div><button data-role="${role}" disabled aria-disabled="true" class="role-btn px-3 py-1 rounded-full text-xs bg-[#f3e8e3] text-[#a77a6a] opacity-70 pointer-events-none">Choose</button></div><div class="text-xs text-gray-600 mt-1">${expl}</div></div>`;
          } else {
            return `<div class="py-2"><div class="flex items-center justify-between"><div class="text-sm font-medium">${role}</div><button data-role="${role}" class="role-btn px-3 py-1 rounded-full bg-[#d3ab9e] text-white text-xs">Choose</button></div><div class="text-xs text-gray-600 mt-1">${expl}</div></div>`;
          }
        }).join('')}
      </div>
    `;

    appendBotHTML(card.outerHTML,{ avatar: false });
    const latest = chatScroll.lastElementChild;
    const header = latest.querySelector('.accordion-header');
    const body = latest.querySelector('.accordion-body');
    header.addEventListener('click', () => {
      body.classList.toggle('show');
    });


latest.querySelectorAll('.role-btn').forEach(btn => {
  if (btn.disabled) {
    btn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    btn.title = "Retake survey to choose a new role";
  } else {
    btn.classList.remove('opacity-70','pointer-events-none','bg-[#f3e8e3]','text-[#a77a6a]','opacity-50','cursor-not-allowed');
    btn.classList.add('bg-[#d3ab9e]','text-white');
    btn.setAttribute('aria-disabled', 'false');
  }
});
  });
  updateRoleButtonsState();
}

// Wire initial start button when page loads 
document.addEventListener('DOMContentLoaded', () => {
  const navLogin = document.getElementById('navLogin');
  if (navLogin) {
    navLogin.addEventListener('click', (e) => {
      e.preventDefault();
      const path = window.location.pathname + window.location.search;
      window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
    });
  }

  // render the intro UI (Start Survey button etc.)
  renderIntroInitial();


  try {
    const p = renderFlashHistoryOnLoad();
    if (p && typeof p.then === 'function') {
      p.catch(err => console.warn("renderFlashHistoryOnLoad failed:", err));
    }
  } catch (e) {
    console.warn("Could not call renderFlashHistoryOnLoad():", e);
  }
});

// login link redirect preservation which kept twice earlier and also harmless
document.addEventListener('DOMContentLoaded', () => {
  const navLogin = document.getElementById('navLogin');
  if (navLogin) {
    navLogin.addEventListener('click', (e) => {
      e.preventDefault();
      const path = window.location.pathname + window.location.search;
      window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
    });
  }
});
