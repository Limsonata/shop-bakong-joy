// CLEAR BROWSER STORAGE
// Run this in your browser console (F12 → Console tab)

// Clear all POS data
localStorage.removeItem('nichnich-pos-v1');
localStorage.removeItem('bakong-cart-store');
localStorage.removeItem('local-cart');

// Clear any other shop-related storage
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('pos') || key.includes('bakong') || key.includes('cart') || key.includes('shop'))) {
    keysToRemove.push(key);
  }
}
keysToRemove.forEach(key => localStorage.removeItem(key));

console.log('✓ Browser storage cleared');
console.log('Remaining localStorage keys:', Object.keys(localStorage));

// Refresh the page
location.reload();
