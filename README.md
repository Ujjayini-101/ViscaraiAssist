
<table>
  <tr>
    <td>
      <img src=https://github.com/Nisha-Mallick/ViscaraiAssist/blob/main/Clogo_image.png
           alt="ViscariaAssist Logo" width="70" height="70"/>
    </td>
    <td style="padding-left: 15px; vertical-align: middle;">
      <h1 style="margin: 0;">VISCARIAASSIST</h1>
    </td>
  </tr>
</table>

> **Empowering Careers Through Seamless AI-Driven Guidance**  
Your personalized AI Career & Skills Advisor built for students and professionals to navigate the evolving job market.

---

## 🚀 Overview

**ViscariaAssist** is a next-gen platform that bridges the gap between **student potential** and **industry expectations**.  
It provides **personalized career guidance, skill-gap analysis, and AI-generated roadmaps** by leveraging **Google Gemini (Pro + Flash)** and **Firebase**.  

No more generic career advice. Each user gets a **custom roadmap**, **actionable skills to learn**, and **real-world job role insights** all saved in their dashboard for continuous growth.

---

## ✨ Why ViscariaAssist?

  **Problem We Solve**  
Students in India often face confusing career choices, outdated counseling methods, and lack clarity on emerging roles.  
Our solution dynamically adapts to their profile and provides **personalized AI guidance**.

  **Our Innovation**  
We integrate **Generative AI + Real-time Data + Skill Analysis** in a single platform with:  
- Personalized survey-driven insights  
- Career recommendations in **3 categories**: *Current Market, Local Opportunities, Future Roles*  
- AI-generated **Skill Gap Analysis**  
- **Zero-to-Hero Roadmap (PDF-ready)** for each chosen career role  
- Voice-enabled chat + persistent memory  

---

## 🛠️ Tech Stack

We carefully selected a **scalable, lightweight, and modern stack**:

### 🔹 Frontend
- <p><img src="https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5"/>
-  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwind-css&logoColor=white" alt="Tailwind CSS"/>
-  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript"/>
</p>

### 🔹 Backend
- <p> <img src="https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white" alt="Node.js"/></p>
- <p> <img src="https://w7.pngwing.com/pngs/212/722/png-transparent-web-development-express-js-javascript-software-framework-laravel-world-wide-web-purple-blue-text.png" alt="Expressjs" Weigth="26" height="25"/></p>
- <p> <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Google_Gemini_logo.svg/2560px-Google_Gemini_logo.svg.png" alt="Gemini2.5pro" Weigth="28" height="25"/>  <b>2.5 Pro</b> – Deep analysis (survey, skill gap, roadmap) </p> 
- <p> <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Google_Gemini_logo.svg/2560px-Google_Gemini_logo.svg.png" alt="GeminiFlash" Weigth="28" height="25"/>  <b> 2.5 Flash</b> – Real-time chat & career Q&A  </p>

### 🔹 Database & Auth
- <p> <img src="https://firebase.google.com/static/downloads/brand-guidelines/SVG/logo-standard.svg" alt="Firestore" Weigth="26" height="25"/> <b> Firestore</b> – Real-time storage of survey answers, chats, roadmaps </p> 
- <p> <img src="https://firebase.google.com/static/downloads/brand-guidelines/SVG/logo-standard.svg" alt="Auth" Weigth="26" height="25"/> <b> Auth</b> – Secure authentication </p>   

### 🔹 Other Integrations
-  **JsPDF** – Client-side roadmap PDF generation  
-  **Google Drive (fallback)** – PDF storage  
-  **Cloudinary** – Profile picture storage  
-  **Web Speech API** – Voice-to-text in chat  

---

## 📸 Key Features

-  Secure Login with Firebase

-  Survey-based personalization (interests, skills, strengths)

-  AI-Powered Career Suggestions across 3 categories

-  Skill Gap Analyzer with % match & missing skills

-  AI Roadmap Generator (downloadable PDF)

-  Chat Window with persistent memory stored in Firestore

 -  Voice-enabled inputs for accessibility

-  Dashboard with goals, skills, and roadmaps

---


## 📂 Project Structure

```
ViscariaAssist/
│
├── .firebase/
├── .github/
│
├── backend/       #From Career-Assist Backend Repo
│   ├── node_modules/
│   ├── tmp_uploads/
│   ├── .env
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── node_modules/
│
├── public/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── 404.html
│   ├── career-assist.html
│   ├── dashboard.html
│   ├── index.html
│   ├── login.html
│   └── take-test.html
│
├── .firebaserc
├── .gitignore
├── cors.json
├── firebase.json
├── package-lock.json
└── package.json
└── README.md
```

---
## ⚙️ Getting Started
### Prerequisites

- Node.js >= 18

- npm >= 9

- Firebase project setup

- Google AI Studio API Key

---

## 🖥️ Installation
```
# Clone the repository
git clone https://github.com/<your-username>/ViscariaAssist

# Make sure your System have Tailwindcss Installed
npm i -D tailwindcss@3 postcss autoprefixer

# Navigate into backend
cd ViscariaAssist/backend

# Make sure Node.js is Installed
node --version
npm --version

# Install dependencies
npm install
```
## ▶️ Run Locally
```
# Start backend
npm start

# Now Navigate to frontend
 cd..

# Open frontend (with Live Server or Firebase Hosting)
or

# Run Frontend Locally
npm run build:css
```
## 📖 Usage

- Login or Signup via Firebase Auth

- Start survey → Answer guided questions

- Get career suggestions across Current Market, Local, Future

- Choose a career role → See skill gap analysis

- Generate 10-step personalized roadmap

- Download roadmap as PDF + track progress in dashboard

- Continue chatting with AI for career queries

---

## 🧑‍💻 Contributors

### Team ViscariaAssist
Built for Google Gen AI Exchange Hackathon 2025 with passion.

## ⭐ Future Enhancements
- Multilingual career guidance (Hindi, Bengali, Tamil, etc.)

-  Mobile app version
  
---  
## 🔄 Process Flow

```mermaid
flowchart TD
    A[User Login] --> B[Takes Career Survey]
    B --> C[ Gemini Pro: Analyze Profile]
    C --> D[ AI Career Suggestions 3 Categories]
    D --> E[ User Chooses Career Role]
    E --> F[ Gemini Pro: Skill Gap Analysis]
    F --> G[ AI Roadmap Generated 10 Steps]
    G --> H[ Roadmap PDF Created & Saved]
    H --> I[ Dashboard: Goals, Skills, Roadmap]
    I --> J[ Ongoing Chat with Gemini Flash]
    J --> K[ Voice Support + Persistent Memory]
