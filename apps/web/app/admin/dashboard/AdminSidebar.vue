<template>
  <aside class="admin-sidebar">
    <div class="logo">WEMOVE Admin</div>
    <ul class="menu">
      <li
        v-for="item in menus"
        :key="item.path"
        :class="{ active: currentPath === item.path }"
        @click="go(item.path)"
      >
        {{ item.label }}
      </li>
    </ul>
    <div class="breadcrumb">Admin / {{ currentLabel }}</div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const menus = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/articles', label: 'Articles' },
  { path: '/admin/categories', label: 'Categories' },
  { path: '/admin/faq', label: 'FAQ' },
  { path: '/admin/announcements', label: 'Announcements' },
  { path: '/admin/media', label: 'Media Library' },
  { path: '/admin/leads', label: 'Contact & Leads' },
  { path: '/admin/seo', label: 'SEO' },
  { path: '/admin/audit', label: 'Audit Logs' },
]

const currentPath = computed(() => route.path)
const currentLabel = computed(() => {
  const found = menus.find(m => m.path === route.path)
  return found ? found.label : ''
})

const go = (path) => {
  router.push(path)
}
</script>

<style scoped>
.admin-sidebar {
  width: 220px;
  height: 100vh;
  background: #304156;
  color: #bfcbd9;
  position: fixed;
  top: 0;
  left: 0;
  overflow-y: auto;
  padding-top: 16px;
}
.logo {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  padding: 0 16px 16px;
  border-bottom: 1px solid #1f2d3d;
  margin-bottom: 12px;
}
.menu {
  list-style: none;
  padding: 0;
  margin: 0;
}
.menu li {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.menu li:hover {
  background: #1f2d3d;
  color: #fff;
}
.menu li.active {
  background: #1f2d3d;
  color: #409EFF;
  border-right: 3px solid #409EFF;
}
.breadcrumb {
  padding: 16px;
  font-size: 12px;
  color: #8a9bb3;
  border-top: 1px solid #1f2d3d;
  margin-top: 16px;
}
</style>