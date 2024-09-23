const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up Multer for file uploads (storing files in the uploads folder)
const upload = multer({ dest: "uploads/" });

// WhatsApp Client Setup
const client = new Client({
  authStrategy: new LocalAuth(),
});

let qrCodeData = null;
let isLoggedIn = false;

client.on("qr", (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    qrCodeData = url;
  });
});

client.on("authenticated", () => {
  isLoggedIn = true;
  qrCodeData = null;
  console.log("WhatsApp authenticated");
});

client.on("ready", () => {
  isLoggedIn = true;
  console.log("WhatsApp is ready!");
});

client.on("auth_failure", () => {
  isLoggedIn = false;
  console.log("Auth failed, please re-login.");
});

client.on("disconnected", () => {
  isLoggedIn = false;
  console.log("WhatsApp is disconnected.");
});

client.initialize();

// API to check login status and serve QR code if not logged in
app.get("/api/check-status", (req, res) => {
  if (isLoggedIn) {
    res.json({ status: "logged_in" });
  } else if (qrCodeData) {
    res.json({ status: "not_logged_in", qr: qrCodeData });
  } else {
    res.json({ status: "waiting_for_qr" });
  }
});

// API to send message or file
app.post("/api/send-message", upload.single("file"), async (req, res) => {
  const { number, message } = req.body;
  if (!isLoggedIn) {
    return res.status(400).json({ error: "Not logged in to WhatsApp" });
  }

  const chatId = number.includes("@c.us") ? number : `${number}@c.us`;

  try {
    // Check if a file is attached
    if (req.file) {
      const filePath = path.join(__dirname, "uploads", req.file.filename);

      // Read the file into a buffer
      const fileBuffer = fs.readFileSync(filePath);

      // Get the file's MIME type and original name
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname;

      // Convert the file to base64 format for sending
      const media = new MessageMedia(
        mimeType,
        fileBuffer.toString("base64"),
        originalName
      );

      // Send the file with or without a message
      await client.sendMessage(chatId, media, { caption: message });

      // Remove the file after sending
      fs.unlinkSync(filePath);
    } else if (message) {
      // If only a message is provided, send the message
      await client.sendMessage(chatId, message);
    }

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

// Server listens on port 3000
app.listen(3500, () => {
  console.log("Server is running on http://localhost:3500");
});
