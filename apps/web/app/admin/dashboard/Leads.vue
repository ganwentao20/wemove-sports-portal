<template>
  <main class="leads">
    <h1>Contact & Leads</h1>

    <div class="toolbar">
      <button @click="refresh">Refresh</button>
      <span class="count">Total: {{ leads.length }}</span>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Subject</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in leads" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.email }}</td>
          <td>{{ row.subject }}</td>
          <td>
            <span class="status-badge" :class="'s-' + row.status">
              {{ statusText(row.status) }}
            </span>
          </td>
          <td>{{ row.created_at }}</td>
          <td>
            <button @click="advance(row)" :disabled="row.status >= 3">
              {{ row.status >= 3 ? 'Closed' : 'Advance →' }}
            </button>
            <button class="danger" @click="remove(row.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>


<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://127.0.0.1:8000'
const leads = ref([])

const statusText = (s) => {
  const map = ['New', 'In Progress', 'Resolved', 'Closed']
  return map[s] || 'Unknown'
}

const loadLeads = async () => {
  try {
    const res = await fetch(`${API}/contacts/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    leads.value = await res.json()
  } catch (e) {
    console.error('加载客户线索失败', e)
  }
}

const refresh = () => {
  loadLeads()
}

const advance = async (row) => {
  if (row.status >= 3) return
  try {
    const params = new URLSearchParams({ status: String(row.status + 1) })
    const res = await fetch(`${API}/contacts/${row.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadLeads()
  } catch (e) {
    console.error('状态更新失败', e)
  }
}

const remove = async (id) => {
  try {
    const res = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    leads.value = leads.value.filter(item => item.id !== id)
  } catch (e) {
    console.error('删除失败', e)
  }
}

onMounted(loadLeads)
</script>

<style scoped>
.leads {
  margin-left: 220px;
  padding: 24px;
}
h1 {
  font-size: 22px;
  margin-bottom: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.count {
  color: #909399;
  font-size: 13px;
}
button {
  background: #409EFF;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 6px;
}
button:disabled {
  background: #c0c4cc;
  cursor: not-allowed;
}
button.danger {
  background: #f56c6c;
}
button.danger:hover {
  background: #f78989;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.data-table th {
  text-align: left;
  padding: 10px 12px;
  background: #f5f7fa;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
}
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}
.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
}
.s-0 { background: #f56c6c; }
.s-1 { background: #e6a23c; }
.s-2 { background: #67c23a; }
.s-3 { background: #909399; }
</style>