document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const startScreen = document.getElementById('start-screen');
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');

    // Inputs & Display
    const regNoInput = document.getElementById('reg-no');
    const testDateSpan = document.getElementById('test-date');
    const timerEl = document.getElementById('timer');

    // Buttons
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const downloadBtn = document.getElementById('download-btn');

    // Quiz Elements
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const progressEl = document.getElementById('progress');
    const questionNumberEl = document.getElementById('question-number');
    const scoreDisplayEl = document.getElementById('score-display');
    const feedbackEl = document.getElementById('feedback');
    const finalScoreEl = document.getElementById('final-score');
    const resultMessageEl = document.getElementById('result-message');

    // --- State ---
    let quizData = []; // Decoded data
    let currentQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let isAnswered = false;
    let studentData = {
        regNo: '',
        date: '',
        tabSwitches: 0
    };
    let timerInterval;

    // --- Init ---
    const today = new Date().toLocaleDateString();
    studentData.date = today;
    testDateSpan.innerText = today;

    // --- Decode Data ---
    try {
        if (typeof encryptedQuizData !== 'undefined') {
            const jsonString = atob(encryptedQuizData);
            quizData = JSON.parse(jsonString);
        } else {
            console.error("Encrypted data not found!");
            alert("Error loading quiz data.");
        }
    } catch (e) {
        console.error("Error decoding data:", e);
        alert("Integrity check failed. Please reload.");
    }

    // --- Anti-Cheating: Focus Tracking ---
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            studentData.tabSwitches++;
            console.log("Focus lost! Count:", studentData.tabSwitches);
            if (studentData.tabSwitches === 1) {
                alert("WARNING: Focus tracking is active.\nSwitching tabs or windows is recorded and will be reported.");
            }
        }
    });

    // --- Anti-Cheating: Input Blocking ---
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
            event.preventDefault();
        }
        // Block Inspect Element shortcuts (F12, Ctrl+Shift+I) - Deterrence
        if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
            event.preventDefault();
        }
    });

    // --- Event Listeners ---
    startBtn.addEventListener('click', startQuiz);

    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            loadQuestion();
        } else {
            finishQuiz();
        }
    });

    downloadBtn.addEventListener('click', () => {
        downloadCSV();
    });

    // --- Functions ---

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function calculateTime(questionObj) {
        // Text to read: Question + all options
        let text = questionObj.question;
        questionObj.options.forEach(opt => text += " " + opt);

        const words = text.split(/\s+/).length;
        // Assume reading speed of ~200 wpm -> ~3.3 words/sec
        // Plus 5-10 seconds thinking time
        let time = Math.ceil(words / 3.3) + 8;

        // Clamp between 10s and 45s
        return Math.min(45, Math.max(10, time));
    }

    function startTimer(duration) {
        let timeLeft = duration;
        timerEl.innerText = `Time: ${timeLeft}s`;
        timerEl.style.color = '#991b1b';

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = `Time: ${timeLeft}s`;

            if (timeLeft <= 10) {
                timerEl.style.color = '#ef4444';
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleTimeout();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function handleTimeout() {
        if (isAnswered) return;
        isAnswered = true;

        // Timeout counts as incorrect
        showFeedback(false, "Time's up!");

        // Disable all options
        const options = optionsContainer.querySelectorAll('.option-btn');
        options.forEach(btn => btn.style.pointerEvents = 'none');

        // Highlight correct answer
        const currentQuizData = currentQuestions[currentQuestionIndex];
        // Note: currentQuizData.shuffledOptions has the 'isCorrect' flag
        currentQuizData.shuffledOptions.forEach((opt, idx) => {
            if (opt.isCorrect) {
                options[idx].classList.add('correct');
            }
        });

        nextBtn.classList.remove('hidden');
    }

    function startQuiz() {
        const regNo = regNoInput.value.trim();
        if (!regNo) {
            alert("Please enter your Registration Number.");
            return;
        }
        studentData.regNo = regNo;

        // Randomize Questions: Select 10
        const shuffledQuestions = shuffleArray([...quizData]);
        const selectedQuestions = shuffledQuestions.slice(0, 10);

        // Process questions to shuffle options per instance
        currentQuestions = selectedQuestions.map(q => {
            // Create option objects
            const optionsWithData = q.options.map((opt, idx) => ({
                text: opt,
                isCorrect: idx === q.answer
            }));

            // Shuffle these options
            const shuffledOptions = shuffleArray([...optionsWithData]);

            return {
                ...q,
                shuffledOptions: shuffledOptions
            };
        });

        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        questionScreen.classList.remove('hidden');

        score = 0;
        currentQuestionIndex = 0;
        loadQuestion();
    }

    function loadQuestion() {
        isAnswered = false;
        const currentQuizData = currentQuestions[currentQuestionIndex];

        questionText.innerText = currentQuizData.question;
        questionNumberEl.innerText = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
        scoreDisplayEl.innerText = `Score: ${score}`;

        const progressPercent = ((currentQuestionIndex) / currentQuestions.length) * 100;
        progressEl.style.width = `${progressPercent}%`;

        optionsContainer.innerHTML = '';
        feedbackEl.classList.add('hidden');
        feedbackEl.innerText = '';
        nextBtn.classList.add('hidden');

        // Render Shuffled Options
        currentQuizData.shuffledOptions.forEach((optionData, index) => {
            const button = document.createElement('div');
            button.classList.add('option-btn');
            button.innerText = optionData.text;
            button.addEventListener('click', () => selectAnswer(optionData.isCorrect, button));
            optionsContainer.appendChild(button);
        });

        // Start Timer
        const timeLimit = calculateTime(currentQuizData);
        startTimer(timeLimit);
    }

    function selectAnswer(isCorrect, selectedButton) {
        if (isAnswered) return;
        stopTimer();
        isAnswered = true;

        // Disable clicks
        const options = optionsContainer.querySelectorAll('.option-btn');
        options.forEach(btn => btn.style.pointerEvents = 'none');

        const currentQuizData = currentQuestions[currentQuestionIndex];

        if (isCorrect) {
            score++;
            selectedButton.classList.add('correct');
            showFeedback(true);
        } else {
            selectedButton.classList.add('incorrect');
            showFeedback(false);
            // Highlight right answer
            currentQuizData.shuffledOptions.forEach((opt, idx) => {
                if (opt.isCorrect) {
                    options[idx].classList.add('correct');
                }
            });
        }

        scoreDisplayEl.innerText = `Score: ${score}`;
        nextBtn.classList.remove('hidden');
    }

    function showFeedback(isCorrect, messageOverride) {
        feedbackEl.classList.remove('hidden');
        feedbackEl.className = 'feedback ' + (isCorrect ? 'correct' : 'incorrect');

        if (messageOverride) {
            feedbackEl.innerText = messageOverride;
        } else {
            feedbackEl.innerText = isCorrect ? 'Correct!' : 'Incorrect!';
        }
    }

    function finishQuiz() {
        stopTimer();
        const result = {
            regNo: studentData.regNo,
            date: studentData.date,
            score: score,
            total: currentQuestions.length,
            percentage: ((score / currentQuestions.length) * 100).toFixed(2) + "%",
            tabSwitches: studentData.tabSwitches
        };

        try {
            localStorage.setItem(`quiz_result_${studentData.regNo}`, JSON.stringify(result));
        } catch (e) { console.error(e); }

        questionScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');

        finalScoreEl.innerText = `${score} / ${currentQuestions.length}`;

        let message = '';
        const pct = (score / currentQuestions.length) * 100;
        if (pct === 100) message = "Perfect! You're a genius!";
        else if (pct >= 80) message = "Great job! Almost perfect.";
        else if (pct >= 50) message = "Good effort! Keep learning.";
        else message = "Better luck next time!";

        if (studentData.tabSwitches > 0) {
            message += `\n(Warning: ${studentData.tabSwitches} tab switches recorded)`;
        }

        resultMessageEl.innerText = message;
    }

    function downloadCSV() {
        const total = currentQuestions.length;
        const percentage = (score / total) * 100;
        const headers = ["Registration Number", "Date", "Score", "Total Questions", "Percentage", "Tab Switches"];
        const rows = [
            [studentData.regNo, studentData.date, score, total, percentage.toFixed(2) + "%", studentData.tabSwitches]
        ];

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\r\n";
        rows.forEach(row => { csvContent += row.join(",") + "\r\n"; });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `quiz_result_${studentData.regNo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
