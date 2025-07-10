// timerManager.js
// This module encapsulates all functionality for the writing timer.
console.log("timerManager.js loaded");

export const timerManager = {
    // --- DOM Elements ---
    timerDurationInput: null,
    timerStartBtn: null,
    writingTimerDisplay: null,
    timerEndSound: null,

    // --- State ---
    timerInterval: null,
    isTimerRunning: false,
    // Store start and end times for accuracy, preventing drift from setInterval.
    startTime: 0,
    endTime: 0,

    /**
     * Initializes the TimerManager, gets DOM elements, and sets up listeners.
     */
    init: function() {
        this.timerDurationInput = document.getElementById('timer-duration-input');
        this.timerStartBtn = document.getElementById('timer-start-btn');
        this.writingTimerDisplay = document.getElementById('writing-timer-display');
        this.timerEndSound = document.getElementById('timer-end-sound');

        if (this.timerStartBtn) {
            this.timerStartBtn.addEventListener('click', () => this._handleStartStopClick());
        }
        this.reset(); // Set initial state
    },

    /**
     * Resets the timer to its initial state. Stops it if it's running.
     * This is intended to be called when the editor is opened or closed.
     */
    reset: function() {
        this.stop();
        this.startTime = 0;
        this.endTime = 0;
        if (this.timerDurationInput) this.timerDurationInput.disabled = false;
        if (this.timerStartBtn) this.timerStartBtn.textContent = 'Start Timer';
        this._updateTimerDisplay(0);
    },

    /**
     * Stops the currently running timer.
     */
    stop: function() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isTimerRunning = false;
    },

    _handleStartStopClick: function() {
        if (this.isTimerRunning) {
            this.stop();
            this.timerStartBtn.textContent = 'Start Timer';
            this.timerDurationInput.disabled = false;
        } else {
            this._start();
        }
    },

    _start: function() { // Refactored for accuracy
        const durationMinutes = parseInt(this.timerDurationInput.value, 10);
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            alert("Please enter a valid duration for the timer.");
            return;
        }
        this.startTime = Date.now();
        this.endTime = this.startTime + (durationMinutes * 60 * 1000);

        this.isTimerRunning = true;
        this.timerStartBtn.textContent = 'Stop Timer';
        this.timerDurationInput.disabled = true;

        this._tick(); // Initial tick to show 00:00

        this.timerInterval = setInterval(() => this._tick(), 1000);
    },

    _tick: function() {
        const now = Date.now();
        const elapsedSeconds = Math.round((now - this.startTime) / 1000);

        this._updateTimerDisplay(elapsedSeconds);

        if (now >= this.endTime) {
            this.stop();
            this.timerStartBtn.textContent = 'Start Timer';
            this.timerDurationInput.disabled = false;
            this._playNotificationSound();
        }
    },

    _updateTimerDisplay: function(elapsedSeconds) {
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.writingTimerDisplay.textContent = `Time: ${timeString}`;

        const targetSeconds = (this.endTime - this.startTime) / 1000;
        this.writingTimerDisplay.classList.toggle('timer-ended', targetSeconds > 0 && elapsedSeconds >= targetSeconds);
    },

    _playNotificationSound: function() {
        if (this.timerEndSound) {
            this.timerEndSound.currentTime = 0; // Rewind to start
            this.timerEndSound.play().catch(err => {
                // Autoplay can be blocked by the browser, but usually not in Electron apps.
                console.warn("Timer notification sound could not be played:", err);
            });
        }
    }
};