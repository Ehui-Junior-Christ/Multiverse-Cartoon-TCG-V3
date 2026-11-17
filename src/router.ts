import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/collection', name: 'collection', component: () => import('./views/CollectionView.vue') },
    { path: '/decks', name: 'decks', component: () => import('./views/DeckBuilderView.vue') },
    { path: '/boutique', name: 'shop', component: () => import('./views/ShopView.vue') },
    { path: '/missions', name: 'missions', component: () => import('./views/MissionsView.vue') },
    { path: '/campagne', name: 'campaign', component: () => import('./views/CampaignView.vue') },
    { path: '/duel', name: 'duel', component: () => import('./views/DuelView.vue') },
    { path: '/profil', name: 'profile', component: () => import('./views/ProfileView.vue') },
    { path: '/connexion', name: 'auth', component: () => import('./views/AuthView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
