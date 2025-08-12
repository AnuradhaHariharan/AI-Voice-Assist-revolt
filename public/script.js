document.addEventListener("DOMContentLoaded", () => {
    const talkButton = document.getElementById("talkButton");
    const statusDiv = document.getElementById("status");
    const socket = io();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        statusDiv.textContent = "Sorry, your browser does not support Speech Recognition.";
        talkButton.disabled = true;
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let isListening = false;
    let chatReady = false;

    // --- Socket.IO Event Handlers ---
    socket.on("connect", () => {
        statusDiv.textContent = "Connected. Initializing AI...";
    });

    socket.on("chat-started", () => {
        chatReady = true;
        talkButton.disabled = false;
        statusDiv.textContent = "Click the mic to speak.";
    });

    socket.on('ai-response-text', (text) => {
        speak(text);
    });

    socket.on("disconnect", () => {
        statusDiv.textContent = "Disconnected. Please refresh.";
        talkButton.disabled = true;
        isListening = false;
        talkButton.classList.remove('recording');
    });

    socket.on("error", (error) => {
        console.error("Server error:", error);
        statusDiv.textContent = `Error: ${error}`;
    });

    // --- Speech Recognition Handlers ---
    recognition.onstart = () => {
        isListening = true;
        talkButton.classList.add('recording');
        statusDiv.textContent = "Listening...";
    };

    recognition.onend = () => {
        isListening = false;
        talkButton.classList.remove('recording');
        // Don't change status here, wait for AI response or user action
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        statusDiv.textContent = `Error in recognition: ${event.error}`;
    };

    recognition.onresult = (event) => {
        const userText = event.results[0][0].transcript;
        statusDiv.textContent = "Thinking...";
        if (chatReady) {
            socket.emit("user-text-message", userText);
        }
    };

    // --- Main Control Logic ---
    talkButton.addEventListener("click", () => {
        // ** CORE OF THE INTERRUPT FEATURE **
        // Stop any currently speaking AI before doing anything else.
        speechSynthesis.cancel();

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    // --- Helper Function to Speak Text ---
    function speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        utterance.onstart = () => {
            statusDiv.textContent = "AI is speaking...";
        };

        utterance.onend = () => {
            // If the AI finishes naturally, reset status if user isn't talking
            if (!isListening) {
                statusDiv.textContent = "Click the mic to speak.";
            }
        };
        
        speechSynthesis.speak(utterance);
    }
});