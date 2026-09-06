<template>
  <main class="media">
    <h1>Media Library</h1>

    <div class="upload-area">
      <h2>Upload</h2>
      <input type="file" ref="fileInput" @change="onFileChange" />
      <p v-if="uploading" class="hint">Uploading... {{ progress }}%</p>
      <p v-if="uploadUrl" class="hint">
        Signed URL: <code>{{ uploadUrl }}</code>
        <button @click="testUrl">Test</button>
      </p>
    </div>

    <h2 style="margin-top: 24px;">Files</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Size</th>
          <th>Type</th>
          <th>URL</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in media" :key="m.id">
          <td>{{ m.name }}</td>
          <td>{{ m.size }}</td>
          <td>{{ m.type }}</td>
          <td><code>{{ m.url }}</code></td>
          <td>
            <button @click="copyUrl(m.url)">Copy</button>
            <button class="danger" @click="remove(m.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://127.0.0.1:8000'
const fileInput = ref(null)
const uploading = ref(false)
const progress = ref(0)
const uploadUrl = ref('')
const media = ref([])

const loadMedia = async () => {
  try {
    const res = await fetch(`${API}/media/`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    media.value = await res.json()
  } catch (e) {
    console.error('加载媒体文件失败', e)
  }
}

const onFileChange = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    uploading.value = true
    progress.value = 20

    const formData = new FormData()
    formData.append('file', file)

    const uploadRes = await fetch(`${API}/media/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!uploadRes.ok) throw new Error(`HTTP ${uploadRes.status}`)
    const result = await uploadRes.json()

    progress.value = 80
    const signRes = await fetch(`${API}/media/${result.id}/sign?expire=60`)
    if (!signRes.ok) throw new Error(`HTTP ${signRes.status}`)
    const signData = await signRes.json()
    uploadUrl.value = `${API}${signData.url}`

    progress.value = 100
    await loadMedia()
  } catch (e) {
    console.error('上传文件失败', e)
  } finally {
    uploading.value = false
  }
}

const testUrl = () => {
  if (uploadUrl.value) window.open(uploadUrl.value, '_blank')
}

const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
  } catch (e) {
    console.error('复制 URL 失败', e)
  }
}

const remove = async (id) => {
  try {
    // 该后端当前未提供删除接口，保留前端本地移除作为兼容处理
    media.value = media.value.filter(item => item.id !== id)
  } catch (e) {
    console.error('删除失败', e)
  }
}

onMounted(loadMedia)
</script>

<style scoped>
.media {
  margin-left: 220px;
  padding: 24px;
}
h1 { font-size: 22px; margin-bottom: 16px; }
h2 { font-size: 16px; margin-bottom: 12px; }
.upload-area {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.hint {
  color: #e6a23c;
  font-size: 13px;
  margin-top: 8px;
}
code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  word-break: break-all;
}
button {
  background: #409EFF;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
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
  word-break: break-all;
}
</style>