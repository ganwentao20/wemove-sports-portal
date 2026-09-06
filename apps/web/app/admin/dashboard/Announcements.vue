<template>
  <main class="announcements">
    <div class="header">
      <h1>Announcements</h1>
      <button @click="dialogVisible = true">+ New</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Content</th>
          <th>Start</th>
          <th>End</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in announcements" :key="a.id">
          <td>{{ a.title }}</td>
          <td>{{ a.content }}</td>
          <td>{{ a.start_date }}</td>
          <td>{{ a.end_date }}</td>
          <td>
            <span class="status-badge" :class="a.active ? 's-2' : 's-3'">
              {{ a.active ? 'Active' : 'Inactive' }}
            </span>
          </td>
          <td>
            <button @click="save(a)">Edit</button>
            <button class="danger" @click="remove(a.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = '/api/v1'
const announcements = ref([])

const loadAnnouncements = async () => {
  try {
    const res = await fetch(`${API}/announcements/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    announcements.value = await res.json()
  } catch (e) {
    console.error('加载公告失败', e)
  }
}

const save = async (item) => {
  try {
    const params = new URLSearchParams({
      title: item.title,
      content: item.content,
      is_top: String(item.is_top ?? 0),
    })

    const method = item.id ? 'PUT' : 'POST'
    const url = item.id ? `${API}/announcements/${item.id}` : `${API}/announcements/`

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadAnnouncements()
  } catch (e) {
    console.error('保存公告失败', e)
  }
}

const remove = async (id) => {
  try {
    const res = await fetch(`${API}/announcements/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadAnnouncements()
  } catch (e) {
    console.error('删除公告失败', e)
  }
}

onMounted(loadAnnouncements)
</script>

<style scoped>
.announcements { margin-left: 220px; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
h1 { font-size: 22px; margin: 0; }
button { background: #409EFF; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 13px; margin-right: 6px; }
button.danger { background: #f56c6c; }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.data-table th { text-align: left; padding: 10px 12px; background: #f5f7fa; color: #606266; border-bottom: 1px solid #ebeef5; }
.data-table td { padding: 10px 12px; border-bottom: 1px solid #ebeef5; }
.status-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #fff; }
.s-2 { background: #67c23a; }
.s-3 { background: #909399; }
</style>