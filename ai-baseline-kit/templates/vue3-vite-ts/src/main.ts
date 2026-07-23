import { createApp } from 'vue';
import App from '@/app/App.vue';
import { router } from '@/app/router';
import '@/theme/theme.css';
import './styles.css';

createApp(App).use(router).mount('#app');
