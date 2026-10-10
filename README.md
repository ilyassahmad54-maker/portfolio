# Ilyas Ahmad — Personal Portfolio Website

A modern, high-performance personal portfolio website built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**. Designed for **Ilyas Ahmad** (Data Analyst | Data Scientist | Machine Learning Engineer) and ready for one-click deployment on **Vercel**.

![Portfolio Preview](/public/assets/projects/multimodal-ai.jpg)

---

## 🌟 Key Features

- **⚡ Next.js 14 App Router**: Server-side rendering, instant static generation, and automatic image optimization (`next/image`).
- **🌓 Dual Theme Support**: Seamless Light & Dark mode with animated Sun/Moon toggle. Dark mode features a deep navy/slate aesthetic (`#0B1120`) with cyan-to-violet gradients; light mode is clean, modern, and recruiter-friendly. The selected theme persists in `localStorage`.
- **🔐 Password-Protected Edit Mode**: Built-in visual editor protected by a SHA-256 cryptographic login gate (`ilyas2025`). Casual visitors cannot access the editor. Includes instant photo uploading, content editing, local autosave, export/import JSON, and session locking.
- **✨ Fluid Animations**: Smooth section reveals on scroll, interactive card hover lifts, floating badges, ambient gradient blobs, and typed role headlines powered by `framer-motion` and `react-type-animation`.
- **📱 Mobile-First & Responsive**: Includes sticky frosted-glass navbar, smooth-scroll spy with active section highlighting, mobile drawer menu, and a floating scroll-to-top button.
- **🎯 100% Data-Driven Architecture**: All portfolio text, experience, projects, skills, and links are centralized in a single file (`/data/portfolio.ts`). Components contain zero hardcoded strings.
- **📬 Live Formspree Contact Form**: Real form submissions connected directly to `https://formspree.io/f/mdeazelj` with spam honeypot protection (`_gotcha`), direct inbox delivery, and genuine API error/success feedback.
- **✉️ Direct Mail Client Integration**: Clicking the email icon in the Contact section, Hero, or Footer automatically triggers `mailto:ilyassahmad54@gmail.com?subject=Portfolio%20Contact` in the visitor's mail application.
- **🔔 Interactive Project Links & Toasts**: Source Code and Demo buttons are fully visible on every project card. Unfinished projects configured with `#` gracefully display an animated toast: *"Link coming soon — I'm still uploading this project."*

---

## 🔐 Admin Access & Password Protection

To prevent casual visitors from tampering with your site, Edit Mode is secured behind an admin passcode gate.

### Default Passcode
- **Passcode**: `ilyas2025`

### How It Works
1. **Triggering Edit Mode**: Click the **"✏️ Edit"** button in the footer or press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac).
2. **Lock Screen Gate**: A dark overlay appears requesting your passcode.
   - If incorrect: An animated shake warning notifies you that access was denied.
   - If correct: The editor opens and stores a temporary session flag (`editUnlocked: "true"`) in `sessionStorage`.
3. **Session Behavior**:
   - As long as the browser tab remains open, you can open and close the editor freely without retyping your passcode.
   - When you close the browser tab, `sessionStorage` clears automatically.
4. **🔒 Lock Button**: Inside the editor header, clicking **"Lock"** immediately clears the session flag and closes the editor. The next person must enter the passcode again.
5. **No Client-Side Backdoors**: The editor panel programmatically verifies `isEditUnlocked()` before rendering any edit controls. If someone dismisses the lock overlay using browser dev tools, the editor refuses to render.
6. **Changing Your Passcode**:
   Open `data/portfolio.ts` and change the `adminPasscode` field:
   ```typescript
   // EDIT: change your edit-mode passcode
   adminPasscode: 'your_new_secret_passcode',
   ```
   *Note: Passcode verification uses client-side SHA-256 via the Web Crypto API (`window.crypto.subtle.digest`). It protects against casual visitors and accidental changes. Never store confidential passwords or API secrets in frontend files.*

---

## ✏️ How to Edit Your Site (Live Browser Editor)

The site includes a comprehensive live browser editing panel so you can update content on your live deployed portfolio without touching code.

### 1. Opening the Editor
- Click the **"✏️ Edit"** button in the footer or press `Ctrl+Shift+E`.
- Enter your passcode (`ilyas2025`) and click **"Unlock Edit Mode"**.

### 2. What You Can Edit
- **Profile Photo**: Click **"Choose New Photo"** to upload any JPG, PNG, or WebP image. The image is instantly converted to base64, previewed, and saved. If the image is over 500KB, a helpful compression reminder appears. Click **"Reset to Default"** at any time to restore the original photo.
- **Profile Details**: Name, Headline/Title, Location, Email, Phone, GitHub URL, LinkedIn URL, Status Badge, and Summary.
- **Skills**: Add new skills, assign them to categories, toggle highlighted badges, and delete skills with one click.
- **Projects**: Add, edit, or delete projects. Upload project screenshots, edit titles, descriptions, categories, comma-separated tech tags, `githubUrl`, and `demoUrl`.
- **Experience**: Add new roles, update company names, locations, date ranges, and multiline achievement bullet points.
- **Education & Certifications**: Update degrees, universities, GPAs, credentials, issuers, and learned skills.

### 3. Autosave & Local Changes Badge
- Every change is **automatically saved to `localStorage`** and re-renders the site in real time.
- When viewing custom local edits, an **"Editing (local changes)"** badge appears in the bottom-left corner with quick access to the editor or a one-click reset button.

### 4. Making Edits Permanent for All Visitors
Because browser edits are saved in your personal browser's `localStorage`, follow these 3 quick steps to publish them permanently to all visitors on Vercel:

1. In the editor action bar, click **"📥 Export JSON"** to download `data.json`.
2. Copy the exported JSON or update the corresponding fields in `data/portfolio.ts` in your local project.
3. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update portfolio content from live editor"
   git push origin main
   ```
   Vercel will automatically detect the push and redeploy your portfolio within ~45 seconds!

### 5. Resetting to Default
Click the **"Reset All"** button in the editor toolbar to wipe local browser edits and restore the original codebase configuration.

---

## 📬 Contact Form & Formspree Integration

The contact form is wired directly to your live Formspree endpoint:
- **Endpoint**: `https://formspree.io/f/mdeazelj`
- **Email**: `ilyassahmad54@gmail.com`
- **Dashboard**: All submitted messages appear in your [Formspree Dashboard](https://formspree.io/) under **Submissions**, and are automatically forwarded to your verified email inbox.
- **Spam Protection**: Includes a hidden Formspree honeypot field (`_gotcha`) to filter out automated bots.
- **Genuine Feedback**: Displays `"Message sent! I'll get back to you soon."` upon HTTP 200 confirmation, or Formspree's actual error message if validation fails.

---

## 🛠️ Development & Deployment

### 1. Install & Run Locally
```bash
npm install
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

### 2. Production Build Test
```bash
npm run build
npm run start
```

### 3. Deploy to Vercel
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy portfolio"
   git push origin main
   ```
2. Log in to [vercel.com](https://vercel.com) and click **"Add New..."** → **"Project"**.
3. Select your GitHub repository and click **"Deploy"**.

---

## 📁 Project Structure

```text
portfolio/
├── app/
│   ├── globals.css              # Tailwind layers, gradients, and dark mode tokens
│   ├── icon.svg                 # Tab favicon (cyan-to-violet gradient with initials)
│   ├── layout.tsx               # Root layout with SEO metadata & theme/portfolio providers
│   └── page.tsx                 # Main single-page portfolio layout
├── components/
│   ├── About.tsx                # Bio, key highlights, and animated counter stats
│   ├── AdminLockModal.tsx       # SHA-256 password lock screen gate
│   ├── Contact.tsx              # Formspree contact form & mailto mail client triggers
│   ├── EditDrawer.tsx           # Full-featured live browser editing panel
│   ├── Education.tsx            # Degree at UET Peshawar & professional certifications
│   ├── Experience.tsx           # Vertical interactive timeline with tech badges
│   ├── Footer.tsx               # Social links, copyright, and "✏️ Edit" button
│   ├── Hero.tsx                 # Typed role animation, CTA buttons, profile photo
│   ├── LocalChangesBadge.tsx    # Floating indicator showing active local edits
│   ├── Navbar.tsx               # Frosted glass nav, active scroll spy, mobile menu
│   ├── PortfolioContext.tsx     # Central state, localStorage persistence & session lock
│   ├── Projects.tsx             # Filterable project cards with demo/code links & toasts
│   ├── ScrollToTop.tsx          # Floating button with smooth scroll
│   ├── SectionHeading.tsx       # Reusable section title with badge & animated bar
│   ├── ThemeProvider.tsx        # React Context for persistent dark/light theme
│   ├── ThemeToggle.tsx          # Animated Sun / Moon toggle button
│   └── Toast.tsx                # Notification toast for links and editor actions
├── data/
│   └── portfolio.ts             # ⭐ SINGLE SOURCE OF TRUTH (All base content & passcode)
├── public/
│   ├── cv.pdf                   # Downloadable resume
│   └── assets/
│       ├── profile.jpg          # Profile portrait image
│       └── projects/            # Project mockups and screenshots
├── types/
│   └── portfolio.ts             # Strict TypeScript interfaces
├── tailwind.config.js           # Custom theme colors and dark mode configuration
└── tsconfig.json                # Path aliases (@/*)
```

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
