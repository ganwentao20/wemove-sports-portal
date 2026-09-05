<template>
  <main class="faq">
    <div class="header">
      <h1>FAQ</h1>
      <button @click="dialogVisible = true">+ New FAQ</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Question</th>
          <th>Answer</th>
          <th>Category</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in faqs" :key="f.id">
          <td>{{ f.id }}</td>
          <td>{{ f.question }}</td>
          <td>{{ f.answer }}</td>
          <td>{{ f.category }}</td>
          <td>
            <button @click="save">Edit</button>
            <button class="danger" @click="remove(f.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const faqs = ref([
  { id: 1, question: 'What age range?', answer: 'Ages 3-12', category: 'General' },
  { id: 2, question: 'Where to buy?', answer: 'Contact dealers', category: 'Purchase' },
])

const save = () => {}
const remove = (id) => {
  faqs.value = faqs.value.filter(f => f.id !== id)
}
</script>

<style scoped>
.faq {
  margin-left: 220px;
  padding: 24px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
h1 { font-size: 22px; margin: 0; }
button {
  background: #409EFF;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  margin-right: 6px;
}
button.danger { background: #f56c6c; }
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
</style>