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
import { ref } from 'vue'

const announcements = ref([
  { id: 1, title: 'New Arrival: Balance Boards', content: 'Summer collection is here!', start_date: '2026-06-01', end_date: '2026-08-31', active: true },
  { id: 2, title: 'Dealer Meeting 2026', content: 'Annual global dealer summit', start_date: '2026-09-15', end_date: '2026-09-20', active: true },
])

const save = (a) => {}
const remove = (id) => {
  announcements.value = announcements.value.filter(x => x.id !== id)
}
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