<template>
  <main class="dashboard">
    <h1>Dashboard</h1>

    <!-- 关键指标卡片 -->
    <div class="cards">
      <div class="card">
        <p class="card-label">Total Articles</p>
        <p class="card-value">{{ stats.articles }}</p>
      </div>
      <div class="card">
        <p class="card-label">Total FAQs</p>
        <p class="card-value">{{ stats.faqs }}</p>
      </div>
      <div class="card">
        <p class="card-label">New Leads</p>
        <p class="card-value">{{ stats.leads }}</p>
      </div>
      <div class="card">
        <p class="card-label">Media Files</p>
        <p class="card-value">{{ stats.media }}</p>
      </div>
    </div>

    <!-- 待办事项 -->
    <div class="panel">
      <h2>Pending Tasks</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pending Leads</td>
            <td>{{ taskCounts.leads }}</td>
            <td><button @click="go('/admin/leads')">Go →</button></td>
          </tr>
          <tr>
            <td>Draft Articles</td>
            <td>{{ taskCounts.articles }}</td>
            <td><button @click="go('/admin/articles')">Go →</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 最近审计日志 -->
    <div class="panel">
      <h2>Recent Audit Logs</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ log.actor }}</td>
            <td>{{ log.action }}</td>
            <td>{{ log.entity }}</td>
            <td>{{ log.created_at }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const stats = ref({ articles: 0, faqs: 0, leads: 0, media: 0 })
const taskCounts = ref({ leads: 0, articles: 0 })
const logs = ref([])

const go = (path) => router.push(path)

onMounted(async () => {
  try {
    const res = await fetch('http://localhost:8000/api/v1/admin/dashboard')
    const data = await res.json()
    stats.value = data
    taskCounts.value = data
  } catch {
    // 后端接口未就绪时，前端正常显示，不报错
  }

  try {
    const res = await fetch('http://localhost:8000/api/v1/admin/audit-logs?limit=10')
    logs.value = await res.json()
  } catch {
    logs.value = []
  }
})
</script>

<style scoped>
.dashboard {
  margin-left: 220px;
  padding: 24px;
}
h1 {
  font-size: 22px;
  margin-bottom: 20px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.card-label {
  color: #909399;
  font-size: 13px;
  margin: 0 0 8px;
}
.card-value {
  font-size: 28px;
  font-weight: bold;
  color: #409EFF;
  margin: 0;
}
.panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.panel h2 {
  font-size: 16px;
  margin: 0 0 12px;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table th {
  text-align: left;
  padding: 8px 12px;
  background: #f5f7fa;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
}
.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
}
button {
  background: #409EFF;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
}
button:hover {
  background: #66b1ff;
}
</style>