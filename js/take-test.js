// ----------------------- take-test.js --------------------------------
// ----------------------- This helper helps us to save current location of user for redirect ------------------
function attachLoginButtons() {
  document.querySelectorAll(".btn-login").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // store the page user came from
      localStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
      window.location.href = "./login.html";
    });
  });
}
attachLoginButtons(); 

// -------- Sample Data ----------
const sampleMock = {
  topic: 'SQL for Data Analyst',
  questions: [
    { q: 'Which SQL clause filters rows?', opts: ['SELECT','WHERE','GROUP BY','ORDER BY'], a: 1 },
    { q: 'What does COUNT(*) do?', opts: ['Counts rows','Counts columns','Sums values','Averages values'], a: 0 },
  ],
};
const sampleApt = {
  topic: 'Logical Reasoning — Sequences',
  questions: [
    { q: 'Next in 2,4,8,16,?', opts: ['18','24','32','30'], a: 2 },
    { q: 'Odd one out: 3, 9, 27, 82', opts: ['3','9','27','82'], a: 3 },
  ],
};

// ------- QA Renderering ---------
function renderQA(container, set, resCb) {
  container.innerHTML = '';
  set.questions.forEach((item, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'mb-4';
    const optsHtml = item.opts.map((o, i) => `
      <label class="flex items-center gap-2 mb-1">
        <input type="radio" name="q${idx}" value="${i}" class="rounded border-[#ebd8d0]">
        <span>${o}</span>
      </label>
    `).join('');
    wrap.innerHTML = `
      <div class="font-semibold mb-1">Question ${idx + 1}:</div>
      <div class="mb-2">${item.q}</div>
      ${optsHtml}
    `;
    container.appendChild(wrap);
  });

  const submit = document.createElement('button');
  submit.className = 'mt-2 rounded-lg bg-[#d3ab9e] hover:bg-[#bc7e6a] text-white px-4 py-2 text-sm font-semibold';
  submit.textContent = 'Submit';
  submit.addEventListener('click', () => {
    let correct = 0;
    set.questions.forEach((item, idx) => {
      const chosen = container.querySelector(`input[name="q${idx}"]:checked`);
      if (chosen && +chosen.value === item.a) correct++;
    });
    resCb({ topic: set.topic, total: set.questions.length, correct, wrong: set.questions.length - correct });
  });
  container.appendChild(submit);
}

function fillResult(prefix, r) {
  const map = {
    Topic: r.topic,
    Score: `${r.correct}/${r.total}`,
    Total: r.total,
    Correct: r.correct,
    Wrong: r.wrong,
  };
  Object.entries(map).forEach(([k, v]) => {
    const id = `${prefix}Res${k}`;
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  });
}

// -------- MOCK TEST wiring ---------
(function mockInit() {
  const mockTopic = $('#mockTopic');
  const mockQWrap = $('#mockQWrap');
  const startMock = $('#startMock');
  const retestMock = $('#retestMock');

  const mockTopicSm = $('#mockTopicSm');
  const mockQWrapSm = $('#mockQWrapSm');
  const startMockSm = $('#startMockSm');
  const retestMockSm = $('#retestMockSm');

  function loadMockDesktop() {
    if (mockTopic) mockTopic.textContent = sampleMock.topic;
    if (mockQWrap) renderQA(mockQWrap, sampleMock, (r) => fillResult('mock', r));
  }
  function loadMockMobile() {
    if (mockTopicSm) mockTopicSm.textContent = sampleMock.topic;
    if (mockQWrapSm) renderQA(mockQWrapSm, sampleMock, (r) => fillResult('mockSm', r));
  }

  if (startMock) startMock.addEventListener('click', loadMockDesktop);
  if (retestMock) retestMock.addEventListener('click', loadMockDesktop);

  if (startMockSm) startMockSm.addEventListener('click', loadMockMobile);
  if (retestMockSm) retestMockSm.addEventListener('click', loadMockMobile);
})();

// ---------- APTITUDE TEST wiring ----------
(function aptInit() {
  const aptTopic = $('#aptTopic');
  const aptQWrap = $('#aptQWrap');
  const startApt = $('#startApt');
  const retestApt = $('#retestApt');

  const aptTopicSm = $('#aptTopicSm');
  const aptQWrapSm = $('#aptQWrapSm');
  const startAptSm = $('#startAptSm');
  const retestAptSm = $('#retestAptSm');

  function loadAptDesktop() {
    if (aptTopic) aptTopic.textContent = sampleApt.topic;
    if (aptQWrap) renderQA(aptQWrap, sampleApt, (r) => fillResult('apt', r));
  }
  function loadAptMobile() {
    if (aptTopicSm) aptTopicSm.textContent = sampleApt.topic;
    if (aptQWrapSm) renderQA(aptQWrapSm, sampleApt, (r) => fillResult('aptSm', r));
  }

  if (startApt) startApt.addEventListener('click', loadAptDesktop);
  if (retestApt) retestApt.addEventListener('click', loadAptDesktop);

  if (startAptSm) startAptSm.addEventListener('click', loadAptMobile);
  if (retestAptSm) retestAptSm.addEventListener('click', loadAptMobile);
})();

// ---------- AI INTERVIEWER MODE ----------
(function aiInit() {
  const startBtn = $('#startInterview');
  const videoEl = $('#video');
  const overlay = $('#aiOverlay');
  const btnEnd = $('#btnEnd');
  const btnCam = $('#btnCam');
  const btnMic = $('#btnMic');
  const qList = $('#aiQuestions');
  const aList = $('#aiAnswers');
  const overallScore = $('#overallScore');
  const aiSuggestions = $('#aiSuggestions');

  const scripted = [
    'Tell me about yourself.',
    'Why are you interested in this role?',
    'Describe a challenging project and your contribution.',
    'How do you handle tight deadlines?',
  ];

  let stream;

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      overlay?.classList.add('hidden');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoEl) videoEl.srcObject = stream;
        fakeInterviewFlow();
      } catch {
        videoEl?.classList.add('bg-[#f7f0ec]');
        alert('Camera/Mic permission denied. Demo continues without media.');
        fakeInterviewFlow();
      }
    });
  }

  function toggleTrack(kind) {
    if (!stream) return;
    const tracks = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach((t) => (t.enabled = !t.enabled));
  }

  function endCall() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay?.classList.remove('hidden');
    if (qList) qList.innerHTML = '';
    if (aList) aList.innerHTML = '';
    if (overallScore) overallScore.textContent = '—';
    if (aiSuggestions) {
      aiSuggestions.innerHTML = `
        <li class="h-3 rounded bg-[#f7f0ec]"></li>
        <li class="h-3 rounded bg-[#f7f0ec] w-11/12"></li>
        <li class="h-3 rounded bg-[#f7f0ec] w-10/12"></li>
        <li class="h-3 rounded bg-[#f7f0ec] w-9/12"></li>`;
    }
  }

  function fakeInterviewFlow() {
    if (!qList || !aList) return;
    qList.innerHTML = '';
    aList.innerHTML = '';
    scripted.forEach((q, i) => {
      setTimeout(() => {
        const liq = document.createElement('li');
        liq.className = 'px-3 py-2 rounded-lg bg-[#fffbff] border border-[#f3e8e3]';
        liq.textContent = q;
        qList.appendChild(liq);

        const lia = document.createElement('li');
        lia.className = 'px-3 py-2 rounded-lg bg-[#f7f0ec] text-[#331e17]/80';
        lia.textContent = '(Your spoken answer transcript will appear here)';
        aList.appendChild(lia);

        if (i === scripted.length - 1) {
          if (overallScore) overallScore.textContent = '6.5 / 10';
          if (aiSuggestions) {
            aiSuggestions.innerHTML = `
              <li class="px-3 py-2 rounded-lg bg-[#fffbff] border border-[#f3e8e3]">Slow down slightly; aim for 140–160 wpm.</li>
              <li class="px-3 py-2 rounded-lg bg-[#fffbff] border border-[#f3e8e3]">Use the STAR framework for experience answers.</li>
              <li class="px-3 py-2 rounded-lg bg-[#fffbff] border border-[#f3e8e3]">Add 1 quantifiable impact per project.</li>
            `;
          }
        }
      }, 900 * (i + 1));
    });
  }

  if (btnEnd) btnEnd.addEventListener('click', endCall);
  if (btnCam) btnCam.addEventListener('click', () => toggleTrack('video'));
  if (btnMic) btnMic.addEventListener('click', () => toggleTrack('audio'));
})();

// ------ This makes the login link redirect back to this page after login. ------
document.addEventListener('DOMContentLoaded', () => {
  const navLogin = document.getElementById('navLogin');
  if (!navLogin) return;
  navLogin.addEventListener('click', (e) => {
    e.preventDefault();
    const path = window.location.pathname + window.location.search;
    window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
  });
});
