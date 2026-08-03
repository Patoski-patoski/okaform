# OKAFOR PATRICK CHIBUIKE

(+234) 8153551975 | codesbypatrick@gmail.com | https://github.com/patoski-patoski | https://www.linkedin.com/in/patrick-okafor-c | https://x.com/CodesByPatrick

## PROFESSIONAL SUMMARY

Backend and Blockchain Software Engineer with 5 years of experience architecting high-performance, production-grade systems. Expert in backend optimisation, having achieved standardised latency reductions and maintained peak application uptime. Specialised in designing multithreaded TCP servers, microservices architectures, and real-time systems. Deeply proficient in Node.js, Python, Rust, and system-level programming, with a proven track record of delivering scalable, security-hardened applications from initial concept to production deployment.

## PROFESSIONAL EXPERIENCE

### Lead Backend and Smart Contract Engineer – Zephyr Protocol
January 2026 - Current
Solana Copy Trading Protocol (Rust/Anchor + Node.js/TypeScript)

- Architected a non-custodial vault system (Anchor PDAs) enforcing transparent trade execution, preventing fee bypass, and enabling automated mirror trading for copier vaults.
- Optimised infrastructure latency by selecting server deployment location based on systematic latency benchmarking across 3 regions, achieving a 16x reduction in RPC latency (14ms → 0.88ms) and improving trade execution speed for the real-time copy trading system.
- Designed a 5-PDA on-chain governance model (Fee, Risk, Tier, Governance, Execution) allowing protocol parameter adjustments without redeploying the program.
- Implemented a 5-tier dynamic revenue model that auto-scales split ratios based on on-chain verified volume, PnL, and AUM — incentivising trader progression.
- Integrated Pyth/Switchboard price oracles and Jupiter V6 swap routing for automated stop-losses, take-profit, and optimised execution across liquidity sources.
- Built a real-time observer-pattern indexer monitoring on-chain master trades and triggering deterministic mirror-trade instructions for linked copier vaults with sub-block latency.
- Developed a performance analytics pipeline computing Sharpe Ratio, rolling AUM, and ROI from on-chain event data using PostgreSQL + Prisma.
- Implemented wallet-based auth (Ed25519 signature verification + JWT) and a verifiable leaderboard ranking traders by real-time on-chain metrics.

### Backend Engineer – KENEI Health
December 2024 - March 2025
A telemedicine organisation that bridges the gap between Medical Practitioners and patients.

- Developed backend architecture: Contributed to the design and implementation of scalable backend systems to support the growing user base and ensure seamless integration with front-end applications.
- Enhanced user onboarding experience: Improved user engagement through streamlined onboarding processes, significantly reducing the time taken for new users to access medical services.
- Documented code using SwaggerAPI: Ensuring clarity and maintainability of code by providing comprehensive documentation, facilitating easier onboarding of new developers.
- Collaborated effectively with development teams: Worked closely with cross-functional teams to meet project deadlines and deliver high-quality software solutions.
- Implemented API integrations: Successfully integrated third-party APIs for payment processing and health data management, enhancing the overall functionality of the application.
- Conducted performance optimisation: Analysed and optimised backend performance, resulting in a 30% reduction in response times and improved user satisfaction.
- Participated in Agile development: Actively engaged in Agile ceremonies, including sprint planning and retrospectives, contributing to continuous improvement and team cohesion.

## PROJECTS

### Okaform — Solana-Native Survey Platform
Solana / Rust (Anchor) + Node.js (NestJS) + MongoDB + React

- Architected a hybrid Web2/Web3 survey platform combining MongoDB for flexible form schemas with Solana PDAs for on-chain escrow, participant registry, and reputation scoring.
- Built a full Anchor program with 6 instructions: initialize_survey, register_participant, initialize_score_account, update_score, close_survey, and distribute_rewards — all with 25+ integration tests.
- Designed push-based reward distribution using Address Lookup Tables (ALTs) for batched transfers of 25–30 recipients per transaction, eliminating claim fees for respondents.
- Implemented wallet-based authentication (SIWS + JWT refresh rotation) with Ed25519 signature verification and sybil filtering (wallet age, SOL balance, funding-graph analysis).
- Built NestJS backend with TypeBox validation, custom exception hierarchy, and structured logging — all 78 unit tests passing.
- Developed React frontend with Tailwind CSS featuring a 3-panel form builder with drag-and-drop (dnd-kit), live preview, and wallet-gated survey filling.
- Integrated on-chain escrow with automatic reward distribution: backend calculates weighted/lucky draw amounts and calls distribute_rewards instruction to transfer SOL from escrow PDA to respondent wallets.
- Deployed to Solana devnet with auto-close logic triggering distribution when max responses is reached.

### Backend Engineer – Automation & Risk Intelligence
June 2025 - July 2025
ProjectRUGGUARD (Python)

- Architected a Twitter bot providing real-time risk analysis, protecting 2,000+ users from fraudulent accounts
- Engineered a multi-faceted heuristic engine analysing 10+ trust signals (account age, follower ratios, NLP bio analysis)
- Pioneered the "web-of-trust" verification system, increasing analysis accuracy.
- Implemented a multi-layer caching strategy, achieving a reduction in redundant API calls
- Implemented automated report generation with colour-coded trust scoring delivered via the Twitter API

### AI & Backend Engineer
Aug 2025 – Oct 2025
MemeStream Agent (TypeScript)

- Architected an AI-powered Telegram bot using Node.js, TypeScript, and Docker, serving meme discovery to an active user base
- Engineered a queue-based processing system with BullMQ and Redis, achieving 99.5% uptime for asynchronous task management
- Integrated Google Gemini AI with function calling and streaming for context-aware meme recommendations
- Implemented an automated web scraping pipeline with Playwright, maintaining a dynamic database of 100+ meme templates
- Established CI/CD pipeline with GitHub Actions and PM2 for zero-downtime deployments

### High-Performance TCP Server
TCP String search server (Python)

- Architected a production-grade multithreaded TCP server with SSL/TLS encryption, rate limiting, and connection management—handling 100+ concurrent clients with sub-millisecond cached response times
- Engineered 10 search algorithms achieving 7-15ms REREAD mode on 250K-line files—exceeding 40ms specification by 62-82% (2.7-5.7x faster than required)
- Implemented comprehensive security hardening: SSL/TLS with certificate verification, IP-based rate limiting, connection semaphores, path traversal protection, and DoS mitigation via early rejection patterns
- Developed a comprehensive benchmark suite comparing algorithmic performance across file sizes (10K-1M lines), producing detailed PDF reports with statistical analysis
- Achieved 100% test coverage, including unit, integration, concurrency, and SSL handshake validation—zero test failures with full type safety via mypy strict mode
- Designed systemd service integration for daemon deployment with automatic restart policies, ensuring 99.9% uptime in production environments
- Maintained strict PEP8/PEP20 compliance with static typing (mypy), comprehensive docstrings, and professional code documentation standards

## SKILLS & TECHNICAL EXPERTISE

**Languages & Core:** Python, JavaScript, TypeScript, Rust, C, Bash, Linux/Unix
**Backend Frameworks:** Node.js (Express, Nest.js, Hono, Socket.io), Django, Flask, Anchor
**Databases & Caching:** MongoDB, MySQL, PostgreSQL, SQLite, Redis
**APIs & Protocols:** REST, gRPC, WebSocket, Message Queues (BullMQ, RabbitMQ)
**System Architecture:** Microservices, Multithreading, TCP/SSL Protocols, API Gateway Design
**DevOps & Infrastructure:** Docker, Nginx, HAProxy, GitHub Actions, Systemd, Prometheus, ELK Stack
**Cloud & Monitoring:** AWS, Cloudflare, Vercel, Render, Datadog, Performance Profiling
**Testing & Code Quality:** Pytest, Jest, Mocha, Unit Testing, Mypy, PEP8 Compliance

## EDUCATION

B.Sc. Biotechnology – Ebonyi State University, Nigeria | Oct 2015 – Mar 2019

## CERTIFICATIONS & PROFESSIONAL DEVELOPMENT

- Solana/Rust Developer (Encode certification, November 2025)
- ALX AI Starter Kit Program Certification (2025)
- ALX Software Engineering Program Certification (2024)
- FullStack Certified Professional, Zuri X I4G Training (2022)
