# Ilyas Ahmad — Personal Portfolio Website

A modern, high-performance personal portfolio website built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**. Designed for **Ilyas Ahmad** (Data Analyst | Data Scientist | Machine Learning Engineer) and ready for one-click deployment on **Vercel**.

![Portfolio Preview](/public/assets/projects/multimodal-ai.jpg)

---

## 🌟 Key Features

- **⚡ Next.js 14 App Router**: Server-side rendering, instant static generation, and automatic image optimization (`next/image`).
- **🌓 Dual Theme Support**: Seamless Light & Dark mode with animated Sun/Moon toggle. Dark mode features a deep navy/slate aesthetic (`#0B1120`) with cyan-to-violet gradients; light mode is clean, modern, and recruiter-friendly. The selected theme persists in `localStorage`.
- **✨ Fluid Animations**: Smooth section reveals on scroll, interactive card hover lifts, floating badges, ambient gradient blobs, and typed role headlines powered by `framer-motion` and `react-type-animation`.
- **📱 Mobile-First & Responsive**: Includes sticky frosted-glass navbar, smooth-scroll spy with active section highlighting, mobile drawer menu, and a floating scroll-to-top button.
- **🎯 100% Data-Driven Architecture**: All portfolio text, experience, projects, skills, and links are centralized in a single file (`/data/portfolio.ts`). Components contain zero hardcoded strings.
- **📄 Interactive Contact & CV Download**: Direct Formspree integration with instant submission feedback and direct PDF download link for your resume (`/public/cv.pdf`).
- **🔍 SEO & Social Sharing**: Preconfigured Open Graph meta tags, Twitter card, search keywords, and dynamic SVG favicon.

---

## 📁 Project Structure

```text
portfolio/
├── app/
│   ├── globals.css         # Tailwind layers, gradients, and dark mode tokens
│   ├── icon.svg            # Tab favicon (cyan-to-violet gradient with initials)
│   ├── layout.tsx          # Root layout with SEO metadata & theme provider
│   └── page.tsx            # Main single-page portfolio layout
├── components/
│   ├── About.tsx           # Bio, key highlights, and animated counter stats
│   ├── Contact.tsx         # Direct contact channels and interactive Formspree form
│   ├── Education.tsx       # Degree at UET Peshawar & professional certifications
│   ├── Experience.tsx      # Vertical interactive timeline with tech badges
│   ├── Footer.tsx          # Social links, copyright, and navigation
│   ├── Hero.tsx            # Typed role animation, CTA buttons, profile photo
│   ├── Navbar.tsx          # Frosted glass nav, active scroll spy, mobile menu
│   ├── Projects.tsx        # Filterable project cards with demo/code links
│   ├── ScrollToTop.tsx     # Floating button with smooth scroll
│   ├── SectionHeading.tsx  # Reusable section title with badge & animated bar
│   ├── ThemeProvider.tsx   # React Context for persistent dark/light theme
│   └── ThemeToggle.tsx     # Animated Sun / Moon toggle button
├── data/
│   └── portfolio.ts        # ⭐ SINGLE SOURCE OF TRUTH (All content lives here)
├── public/
│   ├── cv.pdf              # Downloadable resume
│   └── assets/
│       ├── profile.jpg     # Profile portrait image
│       └── projects/       # Project mockups and screenshots
│           ├── multimodal-ai.jpg
│           ├── helmet-detection.jpg
│           ├── diabetes-care.jpg
│           ├── customer-segmentation.jpg
│           ├── student-ai-dashboard.jpg
│           └── heart-disease-prediction.jpg
├── types/
│   └── portfolio.ts        # Strict TypeScript interfaces
├── tailwind.config.js      # Custom theme colors and dark mode configuration
└── tsconfig.json           # Path aliases (@/*)
```

---

## 🛠️ Getting Started Locally

### 1. Prerequisites
Ensure you have **Node.js** (v18 or newer) and **npm** installed on your system:
```bash
node -v
npm -v
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the site with live hot-reloading.

### 4. Build for Production
To test the production build locally:
```bash
npm run build
npm run start
```

---

## ✏️ How to Customize Your Content

All website content is located in **a single file**: `data/portfolio.ts`. Every editable field has a clear `// EDIT:` comment above it.

### 1. Personal Details & Social Links
Open `data/portfolio.ts` and modify the `profile` and `socialLinks` objects:
```typescript
profile: {
  name: 'Ilyas Ahmad',
  headline: 'Data Analyst | Data Scientist | Machine Learning Engineer',
  roles: [
    'Data Analyst',
    'Data Scientist',
    'Machine Learning Engineer',
    'Computer Vision Specialist',
  ],
  location: 'Peshawar, Pakistan',
  email: 'ilyassahmad54@gmail.com',
  phone: '+92 341 8157001',
  cvUrl: '/cv.pdf',
  profileImage: '/assets/profile.jpg',
  // EDIT: Create a free form at https://formspree.io and paste your endpoint here:
  formspreeEndpoint: 'https://formspree.io/f/YOUR_FORMSPREE_ID',
}
```

### 2. Updating Your GitHub URL
Search for `github` in `data/portfolio.ts`:
```typescript
{
  platform: 'github',
  label: 'GitHub',
  // EDIT: Replace with your actual GitHub profile URL
  url: 'https://github.com/your-username',
  username: 'your-username',
}
```

### 3. Adding or Editing Projects
In `data/portfolio.ts`, update the `projects` array. Each project accepts:
- `title`: Project title
- `slug`: Image slug matching `public/assets/projects/[slug].jpg`
- `category`: `'AI & Computer Vision' | 'Machine Learning' | 'Data Analytics & Viz'`
- `description`: Detailed explanation
- `tags`: Array of technology pills
- `githubUrl`: Link to GitHub repository
- `liveDemoUrl`: Optional live demo link
- `highlights`: Array of bullet points shown on the card

### 4. Swapping Images & Resume
- **Profile Photo**: Replace `public/assets/profile.jpg` with your own square portrait (recommended size: `600x600px` or `800x800px`, JPG format).
- **Project Images**: Replace any file in `public/assets/projects/` (e.g. `multimodal-ai.jpg`, `helmet-detection.jpg`) with your project screenshots (recommended aspect ratio: 16:9, e.g. `800x450px` or `1200x675px`).
- **Resume (CV)**: Replace `public/cv.pdf` with your actual PDF resume. The "Download CV" button automatically links to this file.

---

## 🚀 Deploying to Vercel (Step-by-Step)

Deploying this portfolio on Vercel is completely free and takes less than 2 minutes:

### Step 1: Initialize Git and Push to GitHub
If you haven't already initialized git:
```bash
git init
git add .
git commit -m "Initial commit: Ilyas Ahmad Portfolio"
```

Create a new repository on [GitHub](https://github.com/new) (e.g., `portfolio`), and push your code:
```bash
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/portfolio.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Select your `portfolio` repository from the list and click **"Import"**.

### Step 3: Configure and Deploy
1. **Framework Preset**: Vercel automatically detects `Next.js`.
2. **Root Directory**: Leave as `./` (default).
3. **Build Command**: `next build` (default).
4. **Output Directory**: `.next` (default).
5. Click **"Deploy"**.

Within ~45 seconds, Vercel will build and assign you a live production URL (e.g., `https://portfolio-ilyas-ahmad.vercel.app`) with free SSL, automatic global CDN, and automatic continuous deployment on every `git push`.

---

## 📬 Contact Form Setup (Formspree)

To receive messages from the contact form directly in your personal email:
1. Visit [Formspree](https://formspree.io/) and create a free account.
2. Click **"New Form"** and enter your notification email (`ilyassahmad54@gmail.com`).
3. Copy your Form ID or full endpoint URL (looks like `https://formspree.io/f/mqkvpqqw`).
4. Paste the URL into `data/portfolio.ts` under `profile.formspreeEndpoint`.
5. Push to GitHub — Vercel will redeploy automatically!

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
