<template>
  <main class="seo">
    <h1>SEO Settings</h1>

    <div class="form-card">
      <h2>Global SEO</h2>
      <div class="form-row">
        <label>Site Title</label>
        <input v-model="global.site_title" />
      </div>
      <div class="form-row">
        <label>Meta Description</label>
        <input v-model="global.meta_description" />
      </div>
      <div class="form-row">
        <label>Keywords</label>
        <input v-model="global.keywords" />
      </div>
      <div class="form-row">
        <label>Robots.txt</label>
        <textarea v-model="global.robots" rows="3"></textarea>
      </div>
      <button @click="saveGlobal">Save</button>
    </div>

    <div class="form-card" style="margin-top: 24px;">
      <h2>Page-level SEO</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Title</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pages" :key="p.path">
            <td>{{ p.path }}</td>
            <td><input v-model="p.title" /></td>
            <td><input v-model="p.description" /></td>
            <td><button @click="savePage(p)">Save</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://127.0.0.1:8000'
const global = ref({
  page_key: 'global',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
})
const pages = ref([])

const loadSeo = async () => {
  try {
    const res = await fetch(`${API}/seo/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    pages.value = data
    if (data.length) {
      const globalItem = data.find(item => item.page_key === 'global')
      if (globalItem) {
        global.value = { ...globalItem }
      }
    }
  } catch (e) {
    console.error('加载 SEO 配置失败', e)
  }
}

const saveGlobal = async () => {
  try {
    const params = new URLSearchParams({
      page_key: global.value.page_key,
      meta_title: global.value.meta_title,
      meta_description: global.value.meta_description,
      meta_keywords: global.value.meta_keywords,
    })

    const res = await fetch(`${API}/seo/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadSeo()
  } catch (e) {
    console.error('保存全局 SEO 失败', e)
  }
}

const savePage = async (item) => {
  try {
    const params = new URLSearchParams({
      meta_title: item.meta_title ?? '',
      meta_description: item.meta_description ?? '',
      meta_keywords: item.meta_keywords ?? '',
    })

    const res = await fetch(`${API}/seo/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadSeo()
  } catch (e) {
    console.error('保存页面 SEO 失败', e)
  }
}

onMounted(loadSeo)
</script>

<style scoped>
.seo { margin-left: 220px; padding: 24px; }
h1 { font-size: 22px; margin-bottom: 20px; }
h2 { font-size: 16px; margin: 0 0 12px; }
.form-card { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.form-row { display: flex; align-items: center; margin-bottom: 12px; gap: 12px; }
.form-row label { width: 140px; font-size: 13px; color: #606266; }
.form-row input, .form-row textarea { flex: 1; padding: 8px 12px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
button { background: #409EFF; color: #fff; border: none; border-radius: 4px; padding: 6px 14px; cursor: pointer; font-size: 13px; margin-top: 8px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.data-table th { text-align: left; padding: 10px 12px; background: #f5f7fa; color: #606266; border-bottom: 1px solid #ebeef5; }
.data-table td { padding: 8px 12px; border-bottom: 1px solid #ebeef5; }
</style>