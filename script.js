const { PDFDocument } = PDFLib;

const fileUpload = document.getElementById('file-upload');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const fileNameSpan = document.getElementById('file-name');
const dropHint = document.getElementById('drop-hint');
const rangesContainer = document.getElementById('ranges-container');
const addRangeBtn = document.getElementById('add-range');
const splitButton = document.getElementById('split-button');
const statusDiv = document.getElementById('status');

let pdfFile = null;

// ===== 文件选择 =====

function handleFile(file) {
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        fileNameSpan.textContent = file.name;
        dropHint.textContent = '已选择文件：';
        splitButton.disabled = false;
    } else {
        pdfFile = null;
        fileNameSpan.textContent = '';
        dropHint.textContent = file ? '请选择PDF文件' : '将PDF文件拖拽到此处，或点击选择文件';
        splitButton.disabled = true;
    }
}

dropZone.addEventListener('click', () => fileUpload.click());

fileUpload.addEventListener('change', (event) => {
    handleFile(event.target.files[0]);
});

// ===== 全页面拖拽上传 =====

let dragCounter = 0;

function showOverlay() {
    dropOverlay.classList.remove('hidden');
    dropZone.classList.add('border-blue-600', 'bg-blue-200', 'scale-[1.02]');
}

function hideOverlay() {
    dropOverlay.classList.add('hidden');
    dropZone.classList.remove('border-blue-600', 'bg-blue-200', 'scale-[1.02]');
}

document.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
        showOverlay();
    }
});

document.addEventListener('dragleave', (event) => {
    dragCounter--;
    if (dragCounter === 0) {
        hideOverlay();
    }
});

document.addEventListener('drop', (event) => {
    event.preventDefault();
    dragCounter = 0;
    hideOverlay();
    const file = event.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

// ===== 页码范围管理 =====

let groupCounter = 1;

function createRangeRow(defaultGroup) {
    const row = document.createElement('div');
    row.className = 'range-row flex items-center gap-2';
    row.innerHTML = `
        <input type="number" class="range-start flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="起始页" min="1">
        <span class="text-gray-300 font-bold">—</span>
        <input type="number" class="range-end flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="结束页" min="1">
        <input type="text" class="range-group w-16 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm text-center" placeholder="组名" maxlength="10" value="${defaultGroup}">
        <button class="remove-range flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition duration-200 text-lg leading-none" title="删除此范围">&times;</button>
    `;

    row.querySelector('.remove-range').addEventListener('click', () => {
        removeRange(row);
    });

    return row;
}

function addRange() {
    const row = createRangeRow(groupCounter);
    groupCounter++;
    rangesContainer.appendChild(row);
    updateRemoveButtons();
}

function removeRange(row) {
    const rows = rangesContainer.querySelectorAll('.range-row');
    if (rows.length <= 1) return;
    row.remove();
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const rows = rangesContainer.querySelectorAll('.range-row');
    const buttons = rangesContainer.querySelectorAll('.remove-range');
    const visible = rows.length > 1;
    buttons.forEach(btn => {
        btn.style.visibility = visible ? 'visible' : 'hidden';
    });
}

/** 收集并校验所有页码范围，返回 {ranges} 或 {error} */
function collectRanges() {
    const rows = rangesContainer.querySelectorAll('.range-row');
    const ranges = [];

    for (const row of rows) {
        const startInput = row.querySelector('.range-start');
        const endInput = row.querySelector('.range-end');
        const groupInput = row.querySelector('.range-group');
        const start = parseInt(startInput.value);
        const end = parseInt(endInput.value);

        if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0 || start > end) {
            return { error: '每个范围都必须填写有效的起始页和结束页（起始页 ≤ 结束页）！' };
        }
        ranges.push({ start, end, group: groupInput.value.trim() });
    }

    if (ranges.length === 0) {
        return { error: '请至少添加一个页码范围！' };
    }

    return { ranges };
}

/** 将范围按合并组分组（保持原始顺序） */
function groupRanges(ranges) {
    const groups = [];       // [{ group: string, ranges: [...] }]
    const groupMap = new Map(); // groupName -> index in groups

    for (const r of ranges) {
        const key = r.group || null;
        if (key && groupMap.has(key)) {
            groups[groupMap.get(key)].ranges.push(r);
        } else if (key) {
            groupMap.set(key, groups.length);
            groups.push({ group: key, ranges: [r] });
        } else {
            // 空组名 → 单独一个文件
            groups.push({ group: null, ranges: [r] });
        }
    }

    return groups;
}

/** 触发单个文件下载 */
function downloadPdf(pdfBytes, fileName) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** 根据输出组生成文件名 */
function buildFileName(group, originalName) {
    const rangeLabels = group.ranges.map(r => `${r.start}-${r.end}`).join('_');
    if (group.group) {
        return `${group.group}_${rangeLabels}_${originalName}`;
    }
    return `${rangeLabels}_${originalName}`;
}

// ===== 切割逻辑 =====

splitButton.addEventListener('click', async () => {
    if (!pdfFile) {
        statusDiv.textContent = '请先选择一个PDF文件！';
        statusDiv.style.color = 'red';
        return;
    }

    const collected = collectRanges();
    if (collected.error) {
        statusDiv.textContent = collected.error;
        statusDiv.style.color = 'red';
        return;
    }

    const ranges = collected.ranges;
    const groups = groupRanges(ranges);

    statusDiv.textContent = '正在处理中...';
    statusDiv.style.color = 'blue';
    splitButton.disabled = true;

    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
        const totalPages = srcDoc.getPageCount();

        // 校验所有范围不超过总页数
        for (const r of ranges) {
            if (r.end > totalPages) {
                statusDiv.textContent = `错误：PDF 总共只有 ${totalPages} 页，范围 ${r.start}-${r.end} 超出范围。`;
                statusDiv.style.color = 'red';
                splitButton.disabled = false;
                return;
            }
        }

        // 按组输出
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const newDoc = await PDFDocument.create();

            for (const r of group.ranges) {
                const pageIndices = Array.from(
                    { length: r.end - r.start + 1 },
                    (_, idx) => r.start + idx - 1
                );
                const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
                copiedPages.forEach(page => newDoc.addPage(page));
            }

            const pdfBytes = await newDoc.save();
            const fileName = buildFileName(group, pdfFile.name);

            if (g > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            downloadPdf(pdfBytes, fileName);
        }

        // 生成结果描述
        const desc = groups.map(g => {
            const labels = g.ranges.map(r => `${r.start}-${r.end}`).join('+');
            return g.group ? `"${g.group}"(${labels})` : labels;
        }).join('、');

        statusDiv.textContent = `切割完成！已生成 ${groups.length} 个文件：${desc}。`;
        statusDiv.style.color = 'green';
        splitButton.disabled = false;

    } catch (error) {
        console.error(error);
        statusDiv.textContent = '处理PDF时发生错误。';
        statusDiv.style.color = 'red';
        splitButton.disabled = false;
    }
});

// ===== 初始化 =====
addRangeBtn.addEventListener('click', addRange);
addRange(); // 默认添加第一个范围，组名为 "1"