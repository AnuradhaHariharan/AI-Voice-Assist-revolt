require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Basic Server Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// --- Gemini AI Setup ---
if (!process.env.GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not set in the .env file.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CORRECTED: Define the system instruction as a simple string.
const systemInstructionString = `
    You are Rev, a helpful and friendly AI assistant for Revolt Motors.
    Your goal is to answer questions about Revolt electric motorcycles.
    Keep your answers concise and to the point.
    You must only talk about Revolt Motors. If the user asks about anything else,
    politely decline to answer and steer the conversation back to Revolt Motors.`;

// --- Socket.IO Connection Handling ---
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  let chat; // To hold the chat session for this user

  async function startNewChat() {
    try {
      console.log(`Starting new chat for ${socket.id}`);
      
      // CORRECTED: Pass the system instruction during model initialization.
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemInstructionString,
      });
      
      // CORRECTED: Start the chat with an EMPTY history.
      // The system instruction is now part of the model's configuration.
      chat = model.startChat({
        history: [], 
        generationConfig: {
            maxOutputTokens: 200,
        },
      });

      socket.emit("chat-started");

    } catch (e) {
      console.error("Failed to start chat:", e);
      socket.emit("error", "Failed to initialize the AI assistant.");
    }
  }

  startNewChat();

  // Process incoming text message from the client
  socket.on("user-text-message", async (text) => {
    if (!chat) {
      console.log("Chat not started yet. Ignoring message.");
      return;
    }

    try {
      console.log(`Received text from ${socket.id}: ${text}`);
      const result = await chat.sendMessage(text);
      const response = await result.response;
      const aiText = response.text();

      console.log(`Sending AI response to ${socket.id}: ${aiText}`);
      socket.emit("ai-response-text", aiText);

    } catch (error) {
      console.error("Error with Gemini API:", error);
      socket.emit("error", "An error occurred while communicating with the AI.");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});