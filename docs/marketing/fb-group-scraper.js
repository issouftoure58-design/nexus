/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       NEXUS — Facebook Group Post Extractor (DevTools)         ║
 * ║                   v3 — 9 avril 2026                            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  MODE D'EMPLOI :                                                ║
 * ║                                                                  ║
 * ║  1. Ouvrir un groupe Facebook dans Chrome                       ║
 * ║  2. Ouvrir DevTools (F12 ou Cmd+Option+J)                      ║
 * ║  3. Coller CE SCRIPT ENTIER dans la Console                    ║
 * ║  4. Appuyer Entrée                                              ║
 * ║  5. ATTENDRE — le script scrolle tout seul pendant 3 min       ║
 * ║  6. Un fichier JSON se télécharge automatiquement               ║
 * ║                                                                  ║
 * ║  ⚡ PAS BESOIN DE SCROLLER TOI-MÊME — le script le fait !      ║
 * ║                                                                  ║
 * ║  RÉPÉTER pour chaque groupe.                                    ║
 * ║  Envoyer les fichiers JSON à Claude pour analyse.              ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(async () => {
  // ── Config ──
  const SCROLL_DURATION_MS = 180000; // 3 minutes de scroll auto
  const SCROLL_STEP_MS = 1200;       // pause entre chaque scroll
  const SCROLL_PX = 1000;            // pixels par scroll

  // ── Nom du groupe ───────────────────────────────────────────────
  function getGroupName() {
    const skipWords = ['groupes', 'notifications', 'facebook', 'messenger', 'marketplace', 'groupe'];
    const h1s = document.querySelectorAll('h1');
    for (const h1 of h1s) {
      const txt = h1.innerText?.trim();
      if (txt && txt.length > 2 && txt.length < 120 && !skipWords.includes(txt.toLowerCase())) {
        return txt.replace(/\s*\|\s*Groupes?$/, '').trim();
      }
    }
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle && ogTitle.length > 2) return ogTitle.replace(/\s*\|\s*Facebook$/, '').trim();
    const title = document.title.replace(/\s*\|\s*Facebook$/, '').replace(/^\(\d+\)\s*/, '').trim();
    if (title && !skipWords.includes(title.toLowerCase())) return title;
    const urlMatch = window.location.pathname.match(/^\/groups\/([^/]+)/);
    return urlMatch ? urlMatch[1] : 'groupe_inconnu';
  }

  const GROUP_NAME = getGroupName();
  console.log(`🔍 Groupe : "${GROUP_NAME}"`);
  console.log(`⏳ Auto-scroll pendant ${SCROLL_DURATION_MS / 1000}s — ne touche à rien...`);

  // ── Collecteur de posts (accumule pendant le scroll) ────────────
  const collectedPosts = new Map(); // clé = texte hashé, valeur = post data

  function hashText(t) {
    return t.replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  function extractPostFromNode(node) {
    try {
      // ── Texte ──
      const textParts = [];
      node.querySelectorAll('[dir="auto"]').forEach(block => {
        const t = block.innerText?.trim();
        if (t && t.length > 10) {
          const isButton = /^(J'aime|Commenter|Partager|Like|Comment|Share|Répondre|Voir plus|Voir la traduction|Plus pertinents?|Tous les commentaires|\d+\s*(commentaires?|réactions?|partages?)|Écrire un commentaire|Ce contenu)$/i.test(t);
          if (!isButton && !textParts.some(p => p.includes(t) || t.includes(p))) {
            textParts.push(t);
          }
        }
      });
      let text = textParts.join('\n').slice(0, 3000);

      if (!text || text.length < 15) {
        const raw = node.innerText || '';
        const lines = raw.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 15 && l.length < 2000)
          .filter(l => !/^(J'aime|Commenter|Partager|Répondre|Voir|Like|Comment|Share|\d+\s*(h|j|min|sem|commentaire|réaction)|Écrire|Plus pertinent|Tous les comment)/i.test(l));
        text = lines.slice(0, 8).join('\n');
      }

      if (!text || text.length < 15) return null;

      // ── Auteur ──
      let author = '';
      const authorEl = node.querySelector('h2 a, h3 a, a[role="link"] strong, a[href*="/user/"] strong, a[href*="/profile"] strong');
      if (authorEl) {
        author = authorEl.innerText?.trim().split('\n')[0] || '';
      }
      if (!author) {
        const strong = node.querySelector('strong a, strong');
        author = strong?.innerText?.trim().split('\n')[0] || '';
      }
      if (!author || author.length > 80) {
        // Essayer le premier lien dans le post header
        const firstLink = node.querySelector('a[role="link"]');
        if (firstLink) {
          const t = firstLink.innerText?.trim();
          if (t && t.length > 2 && t.length < 60) author = t;
        }
      }
      author = author || 'Anonyme';

      // ── Timestamp ──
      let timestamp = '';
      const abbrTime = node.querySelector('abbr[data-utime]');
      if (abbrTime) {
        timestamp = new Date(parseInt(abbrTime.getAttribute('data-utime')) * 1000).toISOString();
      }
      if (!timestamp) {
        node.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[role="link"] span').forEach(el => {
          if (timestamp) return;
          const t = el.innerText?.trim();
          if (t && /^\d+\s*(h|j|min|sem|mo|an)/i.test(t) && t.length < 25) {
            timestamp = t;
          }
        });
      }
      if (!timestamp) {
        node.querySelectorAll('[aria-label]').forEach(el => {
          if (timestamp) return;
          const label = el.getAttribute('aria-label') || '';
          if (/\d{1,2}\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i.test(label)) {
            timestamp = label;
          }
        });
      }

      // ── Reactions ──
      let reactions = 0;
      node.querySelectorAll('[aria-label]').forEach(el => {
        const label = el.getAttribute('aria-label') || '';
        const match = label.match(/(\d[\d\s.,]*)\s*(réaction|reaction|j'aime|like|personne)/i);
        if (match) reactions = Math.max(reactions, parseInt(match[1].replace(/[\s.,]/g, '')) || 0);
      });

      // ── Commentaires ──
      let comments = 0;
      node.querySelectorAll('[aria-label]').forEach(el => {
        const label = el.getAttribute('aria-label') || '';
        const match = label.match(/(\d[\d\s.,]*)\s*commentaire/i);
        if (match) comments = Math.max(comments, parseInt(match[1].replace(/[\s.,]/g, '')) || 0);
      });
      if (comments === 0) {
        const m = node.innerText.match(/(\d+)\s*commentaire/i);
        if (m) comments = parseInt(m[1]) || 0;
      }

      return { author: author.slice(0, 80), timestamp, text, reactions, comments };
    } catch (e) {
      return null;
    }
  }

  function scanCurrentPosts() {
    // Essayer plusieurs strategies de detection
    let nodes = document.querySelectorAll('[role="article"]');
    if (nodes.length < 2) {
      const feed = document.querySelector('[role="feed"]');
      if (feed) nodes = feed.children;
    }
    if (nodes.length < 2) {
      nodes = document.querySelectorAll('[data-pagelet^="FeedUnit"]');
    }

    let newCount = 0;
    for (const node of nodes) {
      const post = extractPostFromNode(node);
      if (post) {
        const key = hashText(post.text);
        if (!collectedPosts.has(key)) {
          collectedPosts.set(key, post);
          newCount++;
        }
      }
    }
    return newCount;
  }

  // ── Scan initial ──
  scanCurrentPosts();
  console.log(`📄 Scan initial : ${collectedPosts.size} posts`);

  // ── Auto-scroll + collecte progressive ──────────────────────────
  const startTime = Date.now();
  let scrollCount = 0;
  let noNewPostsStreak = 0;

  while (Date.now() - startTime < SCROLL_DURATION_MS) {
    window.scrollBy({ top: SCROLL_PX, behavior: 'smooth' });
    scrollCount++;

    // Attendre que FB charge les nouveaux posts
    await new Promise(r => setTimeout(r, SCROLL_STEP_MS));

    const newPosts = scanCurrentPosts();
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (newPosts > 0) {
      noNewPostsStreak = 0;
      console.log(`   +${newPosts} posts (total: ${collectedPosts.size}) — ${elapsed}s`);
    } else {
      noNewPostsStreak++;
    }

    // Arreter SEULEMENT si on a depasse le temps minimum ET pas de nouveaux posts
    const MIN_SCROLL_TIME_MS = 120000; // toujours scroller au moins 2 min
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > MIN_SCROLL_TIME_MS && noNewPostsStreak >= 15) {
      console.log(`⏹️ Fin du feed detectee après ${Math.round(elapsedMs/1000)}s (${noNewPostsStreak} scrolls sans nouveaux posts)`);
      break;
    }
  }

  // Remonter en haut
  window.scrollTo({ top: 0, behavior: 'smooth' });

  console.log(`\n✅ Terminé ! ${collectedPosts.size} posts collectés en ${scrollCount} scrolls`);

  // ── Construire le resultat ──
  const posts = Array.from(collectedPosts.values()).map((p, i) => ({ index: i + 1, ...p }));

  const result = {
    group_name: GROUP_NAME,
    extracted_at: new Date().toISOString(),
    url: window.location.href,
    total_posts: posts.length,
    posts,
  };

  // ── Telecharger ──
  const safeName = GROUP_NAME
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const filename = `nexus-fb-${safeName}.json`;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`📥 Fichier : ${filename}`);
  console.log(`\n📊 Résumé :`);
  console.log(`   Groupe : ${GROUP_NAME}`);
  console.log(`   Posts  : ${posts.length}`);

  if (posts.length > 0) {
    console.log(`   Top réactions : ${Math.max(...posts.map(p => p.reactions))}`);
    const topPosts = [...posts].sort((a, b) => (b.reactions + b.comments) - (a.reactions + a.comments)).slice(0, 5);
    console.log(`\n🏆 Top 5 posts :`);
    topPosts.forEach((p, i) => {
      console.log(`   ${i + 1}. [${p.reactions}❤️ ${p.comments}💬] ${p.author} : ${p.text.slice(0, 100)}...`);
    });
  } else {
    console.error('❌ 0 posts ! Verifie que tu es sur la page d\'un GROUPE Facebook.');
  }
})();
