export const FOOD_CATALOG = [
  { id: 'crackers', name: 'Rice Crackers', emoji: '🍘', category: 'Quick Snacks', price: 2, hunger: 14, happiness: 4, quality: 'snack' },
  { id: 'yakult', name: 'Yakult', emoji: '🍶', category: 'Quick Snacks', price: 2, hunger: 12, happiness: 8, quality: 'snack' },
  { id: 'milk', name: 'Strawberry Milk', emoji: '🥛', category: 'Quick Snacks', price: 3, hunger: 14, happiness: 12, quality: 'snack' },
  { id: 'gummybears', name: 'Gummy Bears', emoji: '🐻', category: 'Quick Snacks', price: 3, hunger: 8, happiness: 18, quality: 'snack' },
  { id: 'pocky', name: 'Pocky Sticks', emoji: '🥢', category: 'Quick Snacks', price: 3, hunger: 8, happiness: 22, quality: 'snack' },
  { id: 'onigiri', name: 'Onigiri', emoji: '🍙', category: 'Meals', price: 4, hunger: 22, happiness: 6, quality: 'meal' },
  { id: 'boba', name: 'Bubble Tea', emoji: '🧋', category: 'Quick Snacks', price: 4, hunger: 16, happiness: 24, quality: 'snack' },
  { id: 'mamacup', name: 'Mama Cup Noodle', emoji: '🍜', category: 'Meals', price: 5, hunger: 30, happiness: 18, quality: 'meal' },
  { id: 'takoyaki', name: 'Takoyaki', emoji: '🐙', category: 'Meals', price: 5, hunger: 32, happiness: 22, quality: 'meal' },
  { id: 'donburi', name: 'Donburi Bowl', emoji: '🍚', category: 'Meals', price: 5, hunger: 42, happiness: 18, quality: 'meal' },
  { id: 'icecreambowl', name: 'Sundae', emoji: '🍨', category: 'Special Treats', price: 8, hunger: 18, happiness: 38, quality: 'treat' },
  { id: 'ramen', name: 'Tonkotsu Ramen', emoji: '🍲', category: 'Meals', price: 6, hunger: 50, happiness: 28, quality: 'meal' },
  { id: 'sushiroll', name: 'Sushi Roll', emoji: '🍣', category: 'Meals', price: 6, hunger: 38, happiness: 32, quality: 'meal' },
  { id: 'matchaset', name: 'Matcha Set', emoji: '🍵', category: 'Special Treats', price: 8, hunger: 30, happiness: 50, quality: 'treat' },
  { id: 'mochi', name: 'Mochi Trio', emoji: '🍡', category: 'Special Treats', price: 8, hunger: 32, happiness: 48, quality: 'treat' },
  { id: 'katsu', name: 'Katsu Curry', emoji: '🍛', category: 'Meals', price: 6, hunger: 60, happiness: 35, quality: 'meal' },
  { id: 'strawberry', name: 'Strawberry Tart', emoji: '🍓', category: 'Special Treats', price: 10, hunger: 30, happiness: 65, quality: 'treat' },
  { id: 'wagyu', name: 'Wagyu Steak', emoji: '🥩', category: 'Special Treats', price: 12, hunger: 65, happiness: 60, quality: 'premium' },
  { id: 'omakase', name: 'Omakase Dinner', emoji: '🍱', category: 'Special Treats', price: 14, hunger: 90, happiness: 85, quality: 'premium' },
  { id: 'rainbowcake', name: 'Rainbow Cake', emoji: '🌈', category: 'Special Treats', price: 16, hunger: 70, happiness: 100, quality: 'premium' },
];

export const FOOD_BY_ID = Object.fromEntries(FOOD_CATALOG.map(item => [item.id, item]));
export const FOOD_CATEGORIES = ['Quick Snacks', 'Meals', 'Special Treats'];
