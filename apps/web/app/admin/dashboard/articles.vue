<template>
  <main class="articles">
    <div class="header">
      <h1>Articles</h1>
      <button @click="openCreate">+ New Article</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in articles" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.title }}</td>
          <td>{{ a.category_id }}</td>
          <td>
            <span class="status-badge" :class="'s-' + statusCode(a.status)">
              {{ a.status }}
            </span>
          </td>
          <td>{{ a.created_at }}</td>
          <td>
            <button @click="edit(a)">Edit</button>
            <button class="danger" @click="del(a.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 新建/编辑弹窗 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <h2>{{ editing ? 'Edit Article' : 'New Article' }}</h2>
        <div class="form-item">
          <label>Title</label>
          <input v-model="form.title" placeholder="Article title" />
        </div>
        <div class="form-item">
          <label>Category</label>
          <input v-model="form.category_id" placeholder="Category ID" />
        </div>
        <div class="form-item">
          <label>Content</label>
          <textarea v-model="form.content" rows="5" placeholder="Article content"></textarea>
        </div>
        <div class="form-actions">
          <button @click="save">Save</button>
          <button class="ghost" @click="dialogVisible = false">Cancel</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const articles = ref([])
const dialogVisible = ref(false)
const editing = ref(false)
const form = ref({ title: '', category_id: '', content: '' })

const statusCode = (s) => (typeof s === 'string' ? 1 : 1)

const openCreate = () => {
  editing.value = false
  form.value = { title: '', category_id: '', content: '' }
  dialogVisible.value = true
}

const edit = (a) => {
  editing.value = true
  form.value = { title: a.title, category_id: a.category_id, content: a.content || '' }
  dialogVisible.value = true
}

const save = () => {
  // TODO: 调用后端 POST /api/v1/admin/articles 或 PATCH
  dialogVisible.value = false
}

const del = (id) => {
  articles.value = articles.value.filter(a => a.id !== id)
}
</script>

<style scoped>
.articles {
  margin-left: 220px;
  padding: 24px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
h1 {
  font-size: 22px;
  margin: 0;
}
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
button.danger {
  background: #f56c6c;
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
  background: #67c23a;
}
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 500px;
}
.dialog h2 {
  margin-top: 0;
}
.form-item {
  margin-bottom: 12px;
}
.form-item label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}
.form-item input,
.form-item textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
button.ghost {
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
}
</style>