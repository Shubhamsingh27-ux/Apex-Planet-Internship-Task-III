const decodeHTML = (html) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html; return txt.value;
};

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function show(id) { qsa('section').forEach(s => s.classList.add('hidden')); qs(id).classList.remove('hidden');}

const state = {
    raw: [],
    items: [],
    index: 0,
    chosen: new Map(),
    timer: null,
    perQuestionSec: 25,
};

function buildTriviaURL(opts) {
    const p = new URLSearchParams();
    p.set('amount', Math.min(Math.max(3, +opts.amount || 8), 20));
    if(opts.category) p.set('category', opts.category);
    if(opts.difficulty) p.set('difficulty', opts.difficulty);
    if(opts.type) p.set('type', opts.type);
    return `https://opentdb.com/api.php?${p.toString()}`;
}

async function fetchQuestions(opts) {
    const url = buildTriviaURL(opts);
    const res = await fetch(url);
    const data = await res.json();
    const items = data.results.map((r) => {
        const answers = r.type === 'boolean' ? ['True', 'False'] : shuffle([...r.incorrect_answers, r.correct_answer ]);
        const correctIndex = answers.findIndex(a => a === r.correct_answer);
        return {
            category: r.category,
            difficulty: r.difficulty,
            q: decodeHTML(r.question),
            answers: answers.map(a => decodeHTML(a)),
            correctIndex,
            type: r.type
        };
    });
    return items;
}

async function fetchJoke(into) {
    into.textContent = 'Fetching a joke...';
    try {
        const url = 'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,explicit&safe-mode';
        const res = await fetch(url);
        const joke = await res.json();
        into.innerHTML = joke.type === 'single' ?
        `<strong>Joke:</strong> ${decodeHTML(joke.joke)}` :
        `<strong>Joke:</strong> ${decodeHTML(joke.setup)}<br/><em>${decodeHTML(joke.delivery)}</em>`;
    } catch(e) { into.textContent = 'could not fetch a joke right now.'}
}

function renderQuiz() {
    const i = state.index;
    const item = state.items[i];
    if(!item) {return;}

    const pct = Math.round(((i + 1) / state.items.length) * 100);
    qs('#bar').style.width = pct + '%';

    qs('#meta').textContent = `Q${i+1} / ${state.items.length} - ${item.category} . ${item.difficulty.toUpperCase()}`;

    qs('#question').textContent = item.q;

    const answers = qs('#answers'); answers.innerHTML = '';
    item.answers.forEach((text, idx) => {
        const label = document.createElement('label'); label.className = 'answer';
        label.innerHTML = `
           <input type="radio" name="answer" value="${idx}" aria-label="${text}" />
           <span>${text}</span>
           `;
           label.addEventListener('click', () => choose(idx));
           answers.appendChild(label);
    });

    if(state.chosen.has(i)) {
        const c = state.chosen.get(i);
        choose(c);
        const nodes = qsa('.answer');
        nodes[c]?.classList.add(isCorrect ? 'correct' : 'wrong');
        nodes[c]?.querySelector('input')?.setAttribute('checked', 'checked');
    }

    startTimer();

    qs('#btnPrev').disabled = i === 0;
    qs('#btnNext').textContent = i === state.items.length-1 ? 'Finish' : 'Next';
    qs('#jokeBox').innerHTML = '';
}

function choose(idx) {
    const i = state.index;
    if(!state.items[i]) return;
    state.chosen.set(i, idx);

    const nodes = qsa('.answer');
    nodes.forEach(n => n.classList.remove('correct', 'wrong'));
    const isCorrect = idx === state.items[i].correctIndex;
    nodes[idx].classList.add(isCorrect ? 'correct' : 'wrong');
}

function startTimer() {
    clearInterval(state.timer);
    let left = state.perQuestionSec;
    const el = qs('#timer');
    el.textContent = `${left}s`;
    state.timer = setInterval(() => {
        left--; el.textContent = `${left}s`;
        if(left <= 0) {
            clearInterval(state.timer);
            move(1);
        }
    }, 1000);
}

function move(step) {
    const next = state.index + step;
    if(next < 0 || next >= state.items.length) {
        if(next >= state.items.length){ finish();}
        return;
    }
    state.index = next; renderQuiz();
}

function finish() {
    clearInterval(state.timer);
    let correct = 0;
    state.items.forEach((it, i) => {
        if(state.chosen.get(i) === it.correctIndex) correct++;
    });
    const total = state.items.length;
    qs('#score').textContent = `${correct} / ${total}`;
    const pct = Math.round((correct/total) * 100);
    qs('#detail').textContent = pct >= 80 ? `Excellent! You nailed ${pct}%` : pct >= 50 ? `Nice! You scored ${pct}%` : `keep practicing. Score: ${pct}%`;
    show('#view-result');
}

async function startWith(opts) {
    Object.assign(state, { raw: [], items: [], index: 0, chosen: new Map()});
    qs('#bar').style.width = '0%';
    show('#view-quiz');
    qs('#question').textContent = 'Loading questions...';
    qs('#answers').innerHTML = '';

    try {
        state.items = await fetchQuestions(opts);
    } catch(e) {
        alert('Failed to fetch questions. Please try again.');
        show('#view-settings');
        return;
    }
    renderQuiz();
}

qs('#btnStart').addEventListener('click', () => {
    startWith({
        amount: qs('#amount').value,
        category: qs('#category').value,
        difficulty: qs('#difficulty').value,
        type: qs('#type').value,
    });
});

qs('#btnSample').addEventListener('click', () => {
    qs('#amount').value = 5; qs('#category').value = '18'; qs('#difficulty').value = 'easy'; qs('#type').value = 'multiple';
    qs('#btnStart').click();
});

qs('#btnNext').addEventListener('click', () => move(1));
qs('#btnPrev').addEventListener('click', () => move(-1));

qs('#btnRestart').addEventListener('click', () => { show('#view-settings');});
qs('#btnSetting').addEventListener('click', () => { show('#view-settings');});
qs('#btnRestartAll').addEventListener('click', () => { location.reload();});

qs('#btnJoke').addEventListener('click', () => fetchJoke(qs('#jokeBox')));
qs('#btnJokeTop').addEventListener('click', () => fetchJoke(qs('#jokeBoxSettings')));

window.addEventListener('keydown', (e) => {
    if(qs('#view-quiz').classList.contains('hidden')) return;
    if(e.key === 'ArrowRight') move(1);
    if(e.key === 'ArrowLeft') move(-1);
});