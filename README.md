# Ilyas Ahmad — Personal Portfolio Website

A modern, high-performance personal portfolio website built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**. Designed for **Ilyas Ahmad** (Data Analyst | Data Scientist | Machine Learning Engineer) and ready for one-click deployment on **Vercel**.

![Portfolio Preview](/public/assets/projects/multimodal-ai.jpg)

---

## 🌟 Key Features

- **⚡ Next.js 14 App Router**: Server-side rendering, instant static generation, and automatic image optimization (`next/image`).
- **🌓 Dual Theme Support**: Seamless Light & Dark mode with animated Sun/Moon toggle. Dark mode features a deep navy/slate aesthetic (`#0B1120`) with cyan-to-violet gradients; light mode is clean, modern, and recruiter-friendly. The selected theme persists in `localStorage`.
- **🔐 Server-authenticated Edit Mode**: Server-validated sessions protect entry to the browser-local editor.
- **✨ Fluid Animations**: Smooth section reveals on scroll, interactive card hover lifts, floating badges, ambient gradient blobs, and typed role headlines powered by `framer-motion` and `react-type-animation`.
- **📱 Mobile-First & Responsive**: Includes sticky frosted-glass navbar, smooth-scroll spy with active section highlighting, mobile drawer menu, and a floating scroll-to-top button.
- **🎯 100% Data-Driven Architecture**: All portfolio text, experience, projects, skills, and links are centralized in a single file (`/data/portfolio.ts`). Components contain zero hardcoded strings.
- **📬 Live Formspree Contact Form**: Real form submissions connected directly to `https://formspree.io/f/mdeazelj` with spam honeypot protection (`_gotcha`), direct inbox delivery, and genuine API error/success feedback.
- **✉️ Direct Mail Client Integration**: Clicking the email icon in the Contact section, Hero, or Footer automatically triggers `mailto:ilyassahmad54@gmail.com?subject=Portfolio%20Contact` in the visitor's mail application.
- **🔔 Interactive Project Links & Toasts**: Source Code and Demo buttons are fully visible on every project card. Unfinished projects configured with `#` gracefully display an animated toast: *"Link coming soon — I'm still uploading this project."*

---

## Admin authentication and Vercel configuration

Editing creates browser-local drafts only. It does not publish content or write to a shared database. A browser owner can always modify their own localStorage; server authentication cannot prevent that. Publishing still requires a repository update and deployment. There are no content-write admin APIs.

In Vercel → Project → Settings → Environment Variables, configure these server-only variables for Production (and Preview only if you want preview editing):

- `ADMIN_PASSCODE`: a new unique random passcode of at least 20 characters. Treat the previously published password as compromised; never reuse it.
- `UPSTASH_REDIS_REST_URL`: the HTTPS REST URL from a dedicated Upstash Redis database.
- `UPSTASH_REDIS_REST_TOKEN`: its write-capable REST token. The database stores expiring sessions and login counters.

Never prefix these with `NEXT_PUBLIC_`, put them in portfolio data, or commit them. For local development use an ignored `.env.local`. Missing configuration or Redis failures disable login. Configure the variables before an approved deployment; environment changes require redeployment.

Login uses a same-origin POST, server-side constant-time credential comparison, and a random opaque session. Production cookies use Secure, HttpOnly, SameSite=Strict and the __Host- prefix. Sessions expire after one hour, are revoked on logout, and become invalid when the passcode rotates. Redis enforces five login requests per 15 minutes per Vercel client IP across function instances. All attempts count, including successful ones. Unknown client addresses share one bucket. Consider an additional Vercel Firewall login rule for abuse protection.

The session API validates the stored session on every request. The editor checks it before opening and before app-managed saves/reset. UI checks are not authorization: any future shared content-write API must validate the session server-side before writing. Never rely on a React flag. Cross-origin login/logout requests are rejected; authentication responses are not cached. Logout requires the session store to succeed and reports failures for retry.

Validation: run `node --test tests/admin-auth.cjs`, `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`. Authentication tests use a mocked Redis REST service; verify login, expiration, rate limiting and logout against the configured Upstash database in a preview before production rollout. The production-readiness review upgrades Next.js to 15.5.27 (retaining React 18), eslint-config-next to 15.5.27, ESLint to 9, and PostCSS to 8.5.29. Overrides use the patched PostCSS version inside Next.js and postcss-selector-parser 7.1.6 for Tailwind. The audit reports zero production-dependency vulnerabilities and seven high-severity development/build dependency findings, all stemming from unpatched braces <=3.0.3. No patched braces version is published. Avoid processing untrusted glob patterns in build tooling; eliminating this chain requires a separately validated styling/toolchain migration. Next.js 15 still supports the existing next lint command, but deprecates it.

The old password remains in Git history and previous deployments until separately removed; it is no longer accepted. Do not reuse it elsewhere. No history rewrite or deployment is performed by this change.

---

## ✏️ How to Edit Your Site (Live Browser Editor)

The site includes a comprehensive live browser editing panel so you can update content on your live deployed portfolio without touching code.

### 1. Opening the Editor
- Click the **"✏️ Edit"** button in the footer or press `Ctrl+Shift+E`.
- Enter your configured admin passcode and click **"Unlock Edit Mode"**.

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
│   ├── AdminLockModal.tsx       # Server login dialog
│   ├── Contact.tsx              # Formspree contact form & mailto mail client triggers
│   ├── EditDrawer.tsx           # Full-featured live browser editing panel
│   ├── Education.tsx            # Degree at UET Peshawar & professional certifications
│   ├── Experience.tsx           # Vertical interactive timeline with tech badges
│   ├── Footer.tsx               # Social links, copyright, and "✏️ Edit" button
│   ├── Hero.tsx                 # Typed role animation, CTA buttons, profile photo
│   ├── LocalChangesBadge.tsx    # Floating indicator showing active local edits
│   ├── Navbar.tsx               # Frosted glass nav, active scroll spy, mobile menu
│   ├── PortfolioContext.tsx     # Central state, localStorage persistence & server session validation
│   ├── Projects.tsx             # Filterable project cards with demo/code links & toasts
│   ├── ScrollToTop.tsx          # Floating button with smooth scroll
│   ├── SectionHeading.tsx       # Reusable section title with badge & animated bar
│   ├── ThemeProvider.tsx        # React Context for persistent dark/light theme
│   ├── ThemeToggle.tsx          # Animated Sun / Moon toggle button
│   └── Toast.tsx                # Notification toast for links and editor actions
├── data/
│   └── portfolio.ts             # ⭐ SINGLE SOURCE OF TRUTH (All base content)
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
