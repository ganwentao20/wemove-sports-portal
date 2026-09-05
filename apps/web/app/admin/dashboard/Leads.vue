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
import { ref } from 'vue'

const leads = ref([])

const statusText = (s) => {
  const map = ['New', 'In Progress', 'Resolved', 'Closed']
  return map[s] || 'Unknown'
}

// 本地初始数据（后续会被后端数据替换）
const initData = () => {
  leads.value = [
    { id: 1, name: 'John', email: 'john@example.com', subject: 'Bowling set inquiry', status: 0, created_at: '2026-09-05' },
    { id: 2, name: 'Jane', email: 'jane@example.com', subject: 'Dealer application', status: 1, created_at: '2026-09-05' },
  ]
}

const refresh = async () => {
  try {
    const res = await fetch('http://localhost:8000/api/v1/admin/leads')
    leads.value = await res.json()
  } catch {
    // 接口未就绪，显示本地数据
    refreshLocal()
  }
}

const refreshLocal = () => {
  if (leads.value.length === 0) initData()
}

const advance = async (row) => {
  if (row.status < 3) row.status++
  // TODO: 调用后端 PATCH /api/v1/admin/leads/:id/status
}

const remove = (id) => {
  leads.value = leads.value.filter(l => l.id !== id)
}

initData()
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