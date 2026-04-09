/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       NEXUS — Facebook Group Post Extractor (DevTools)         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  MODE D'EMPLOI :                                                ║
 * ║                                                                  ║
 * ║  1. Ouvrir un groupe Facebook dans Chrome                       ║
 * ║  2. SCROLLER VERS LE BAS pendant 30-60 secondes                ║
 * ║     (pour charger ~20-50 posts)                                 ║
 * ║  3. Ouvrir DevTools (F12 ou Cmd+Option+J)                      ║
 * ║  4. Coller CE SCRIPT ENTIER dans la Console                    ║
 * ║  5. Appuyer Entrée                                              ║
 * ║  6. Un fichier JSON se télécharge automatiquement               ║
 * ║                                                                  ║
 * ║  RÉPÉTER pour chaque groupe.                                    ║
 * ║  Envoyer les fichiers JSON à Claude pour analyse.              ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(() => {
  const GROUP_NAME = document.querySelector('h1')?.innerText
    || document.title.replace(' | Facebook', '').trim()
    || 'groupe_inconnu';

  console.log(`🔍 Extraction du groupe : "${GROUP_NAME}"...`);

  // ── Sélecteurs FB (avril 2026) ──────────────────────────────────
  // FB utilise des classes dynamiques, on cible la structure DOM stable
  const posts = [];

  // Méthode 1 : sélecteur role="article" (posts dans le feed)
  const articleNodes = document.querySelectorAll('[role="article"]');

  // Méthode 2 (fallback) : divs de feed avec data-pagelet
  const feedPosts = articleNodes.length > 0
    ? articleNodes
    : document.querySelectorAll('[data-pagelet^="FeedUnit"]');

  console.log(`📄 ${feedPosts.length} posts trouvés dans le DOM`);

  feedPosts.forEach((node, index) => {
    try {
      // ── Texte du post ──
      // FB met le contenu dans des divs avec dir="auto" et data-ad-preview="message"
      // ou simplement les blocs de texte dans le post
      const textBlocks = node.querySelectorAll(
        '[data-ad-preview="message"], [dir="auto"]:not(span):not(a)'
      );
      let text = '';
      textBlocks.forEach(block => {
        const t = block.innerText?.trim();
        if (t && t.length > 15 && !text.includes(t)) {
          text += (text ? '\n' : '') + t;
        }
      });

      // Fallback : prendre le innerText du post et nettoyer
      if (!text || text.length < 20) {
        const raw = node.innerText || '';
        // Prendre les lignes entre 20 et 2000 chars (filtrer nav/boutons)
        const lines = raw.split('\n').filter(l => l.length > 20 && l.length < 2000);
        text = lines.slice(0, 10).join('\n');
      }

      if (!text || text.length < 20) return; // Skip posts vides/images seules

      // ── Auteur ──
      // Le premier lien <a> avec un href profil dans le post
      const authorLink = node.querySelector('a[href*="/user/"], a[href*="/profile"], a[href*="facebook.com/"][role="link"]');
      const author = authorLink?.innerText?.trim()
        || node.querySelector('strong')?.innerText?.trim()
        || 'Anonyme';

      // ── Date / timestamp ──
      // FB utilise des <abbr> ou des <span> avec aria-label pour les dates
      const timeEl = node.querySelector('abbr[data-utime], a[href*="/posts/"] span, [aria-label*="202"]');
      const timestamp = timeEl?.getAttribute('data-utime')
        ? new Date(parseInt(timeEl.getAttribute('data-utime')) * 1000).toISOString()
        : timeEl?.innerText?.trim()
        || timeEl?.getAttribute('aria-label')
        || '';

      // ── Réactions (count approximatif) ──
      // Le compteur de réactions est souvent dans un span près de l'icône like
      const reactionSpans = node.querySelectorAll('[aria-label*="réaction"], [aria-label*="reaction"], [aria-label*="J\'aime"]');
      let reactions = 0;
      reactionSpans.forEach(span => {
        const label = span.getAttribute('aria-label') || span.innerText || '';
        const match = label.match(/(\d[\d\s,.]*)/);
        if (match) {
          reactions = Math.max(reactions, parseInt(match[1].replace(/[\s,.]/g, '')) || 0);
        }
      });

      // Fallback réactions : chercher un nombre près des boutons J'aime
      if (reactions === 0) {
        const allSpans = node.querySelectorAll('span');
        allSpans.forEach(span => {
          const t = span.innerText?.trim();
          if (t && /^\d+$/.test(t) && parseInt(t) > 0 && parseInt(t) < 50000) {
            reactions = Math.max(reactions, parseInt(t));
          }
        });
      }

      // ── Commentaires count ──
      const commentEl = node.querySelector('[aria-label*="commentaire"], [aria-label*="comment"]');
      let comments = 0;
      if (commentEl) {
        const match = (commentEl.getAttribute('aria-label') || commentEl.innerText || '').match(/(\d+)/);
        if (match) comments = parseInt(match[1]) || 0;
      }

      posts.push({
        index: index + 1,
        author: author.slice(0, 80),
        timestamp,
        text: text.slice(0, 3000), // Limiter la taille
        reactions,
        comments,
      });
    } catch (e) {
      console.warn(`⚠️ Erreur post #${index + 1}:`, e.message);
    }
  });

  console.log(`✅ ${posts.length} posts extraits avec contenu`);

  // ── Construire le résultat ──
  const result = {
    group_name: GROUP_NAME,
    extracted_at: new Date().toISOString(),
    url: window.location.href,
    total_posts: posts.length,
    posts,
  };

  // ── Télécharger en JSON ──
  const filename = `nexus-fb-${GROUP_NAME.replace(/[^a-zA-Z0-9àâéèêëïôùûç\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)}.json`;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`📥 Fichier téléchargé : ${filename}`);
  console.log(`\n📊 Résumé :`);
  console.log(`   Groupe : ${GROUP_NAME}`);
  console.log(`   Posts  : ${posts.length}`);
  console.log(`   Top réactions : ${Math.max(...posts.map(p => p.reactions), 0)}`);

  // Afficher les 3 posts les plus engagés
  const topPosts = [...posts].sort((a, b) => (b.reactions + b.comments) - (a.reactions + a.comments)).slice(0, 3);
  if (topPosts.length > 0) {
    console.log(`\n🏆 Top 3 posts :`);
    topPosts.forEach((p, i) => {
      console.log(`   ${i + 1}. [${p.reactions}❤️ ${p.comments}💬] ${p.text.slice(0, 100)}...`);
    });
  }
})();
