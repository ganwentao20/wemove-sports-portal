<template>
  <main class="audit">
    <h1>Audit Logs</h1>

    <div class="filters">
      <select v-model="filter.actor">
        <option value="">All Actors</option>
        <option v-for="a in actors" :key="a" :value="a">{{ a }}</option>
      </select>
      <select v-model="filter.action">
        <option value="">All Actions</option>
        <option v-for="a in actions" :key="a" :value="a">{{ a }}</option>
      </select>
      <button @click="load">Filter</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Actor</th>
          <th>Action</th>
          <th>Entity</th>
          <th>Before</th>
          <th>After</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id">
          <td>{{ log.id }}</td>
          <td>{{ log.actor }}</td>
          <td>{{ log.action }}</td>
          <td>{{ log.entity }}</td>
          <td><code v-if="log.before">{{ log.before }}</code><span v-else>-</span></td>
          <td><code v-if="log.after">{{ log.after }}</code><span v-else>-</span></td>
          <td>{{ log.created_at }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const filter = ref({ actor: '', action: '' })
const logs = ref([])
const actors = ref(['admin', 'content_operator', 'customer_service'])
const actions = ref(['create', 'update', 'delete', 'login'])

const load = async () => {
  let url = 'http://localhost:8000/api/v1/admin/audit-logs?limit=100'
  if (filter.value.actor) url += '&actor=' + filter.value.actor
  if (filter.value.action) url += '&action=' + filter.value.action
  try {
    const res = await fetch(url)
    logs.value = await res.json()
  } catch {
    // 暂无数据
  }
}

load()
</script>

<style scoped>
.audit { margin-left: 220px; padding: 24px; }
h1 { font-size: 22px; margin-bottom: 16px; }
.filters { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.filters select { padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 14px; }
button { background: #409EFF; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.data-table th { text-align: left; padding: 10px 12px; background: #f5f7fa; color: #606266; border-bottom: 1px solid #ebeef5; }
.data-table td { padding: 8px 12px; border-bottom: 1px solid #ebeef5; word-break: break-all; }
code { background: #f5f7fa; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
</style>