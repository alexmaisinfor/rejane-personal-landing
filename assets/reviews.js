'use strict';
const reviewList = document.querySelector('#review-list');
const reviewStatus = document.querySelector('#reviews-status');
const moreControls = document.createElement('div'); moreControls.className = 'reviews-more';
const moreButton = document.createElement('button'); moreButton.type = 'button'; moreButton.className = 'button secondary'; moreButton.textContent = 'Mostrar mais'; moreButton.hidden = true; moreButton.setAttribute('aria-controls','review-list');
moreControls.append(moreButton); reviewList.after(moreControls);
const seenReviews = new Set();
let nextCursor = null;
let loading = false;
reviewStatus.setAttribute('aria-live','polite');
async function loadReviews(loadMore = false) {
  if (loading) return;
  loading = true; moreButton.disabled = true;
  reviewList.setAttribute('aria-busy','true');
  try {
    const response = await fetch('/api/reviews' + (loadMore && nextCursor ? '?cursor=' + encodeURIComponent(nextCursor) : ''),{cache:'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    const {reviews,nextCursor:cursor} = await response.json();
    if (!loadMore) { reviewList.replaceChildren(); seenReviews.clear(); }
    nextCursor = cursor;
    moreButton.hidden = !nextCursor;
    if (!reviews.length) { reviewStatus.textContent = 'Em breve, experiências de quem treina com a Rejane. As avaliações são enviadas por alunos convidados.'; return; }
    reviewStatus.textContent = 'Experiências compartilhadas por alunos convidados.';
    let firstNewCard;
    reviews.forEach(review => {
      if (seenReviews.has(review.id)) return;
      seenReviews.add(review.id);
      const article = document.createElement('article'); article.className = 'card review-card'; article.tabIndex = -1;
      firstNewCard ||= article;
      const top = document.createElement('div'); top.className = 'review-top';
      const label = document.createElement('span'); label.className = 'review-label'; label.textContent = 'EXPERIÊNCIA DE ALUNO';
      const stars = document.createElement('span'); stars.className = 'stars'; stars.setAttribute('aria-label',`${review.rating} de 5 estrelas`); stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5-review.rating);
      top.append(label,stars);
      if (review.pinned) { const badge = document.createElement('span'); badge.className = 'review-pin-badge'; badge.textContent = 'Fixado'; article.append(badge); }
      const quote = document.createElement('blockquote'); quote.textContent = review.message;
      const person = document.createElement('div'); person.className = 'review-person';
      const avatar = document.createElement('span'); avatar.className = 'review-initial'; avatar.setAttribute('aria-hidden','true'); avatar.textContent = Array.from(review.name)[0].toLocaleUpperCase('pt-BR');
      if (review.has_photo) {
        avatar.className = 'review-avatar'; avatar.replaceChildren();
        const image = document.createElement('img'); image.src = `/review-photos/${review.id}.webp`; image.alt = ''; image.loading = 'lazy'; avatar.append(image);
      }
      const name = document.createElement('h3'); name.textContent = review.name;
      person.append(avatar,name); article.append(top,quote,person); reviewList.append(article);
    });
    reviewStatus.textContent = `${seenReviews.size} avaliações exibidas. Experiências compartilhadas por alunos convidados.`;
    if (loadMore && firstNewCard) firstNewCard.focus({preventScroll:true});
  } catch { reviewStatus.textContent = loadMore ? 'Não foi possível carregar mais avaliações. Tente novamente.' : 'As avaliações estarão disponíveis em breve. Para conhecer o acompanhamento, converse com a Rejane.'; }
  finally { loading = false; moreButton.disabled = false; reviewList.setAttribute('aria-busy','false'); }
}
moreButton.addEventListener('click',() => loadReviews(true));
loadReviews();
