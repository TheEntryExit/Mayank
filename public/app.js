const dailyForm = document.getElementById("daily-form");
const responseForm = document.getElementById("response-form");

const dailyDate = document.getElementById("daily-date");
const responseDate = document.getElementById("response-date");
const rangeStart = document.getElementById("range-start");
const rangeEnd = document.getElementById("range-end");

const dailyTable = document.getElementById("daily-table");
const responseTable = document.getElementById("response-table");
const responseAnalytics = document.getElementById("response-analytics");
const ticketsAnalytics = document.getElementById("tickets-analytics");

const avgResponse = document.getElementById("avg-response");
const fastestResponse = document.getElementById("fastest-response");
const slowestResponse = document.getElementById("slowest-response");
const totalResponses = document.getElementById("total-responses");
const rangeTotal = document.getElementById("range-total");

const ticketsChart = document.getElementById("tickets-chart");
const chartContext = ticketsChart.getContext("2d");

const toMinutes = (ms) => (ms ? (ms / 60000).toFixed(2) : "0.00");
const today = new Date().toISOString().split("T")[0];

dailyDate.value = today;
responseDate.value = today;
rangeStart.value = today;
rangeEnd.value = today;

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
};

const refreshDaily = async () => {
  const rows = await fetchJson("/api/daily");
  dailyTable.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.tickets_replied}</td>
      <td>${row.work_start}</td>
      <td>${row.work_end}</td>
      <td>
        <button class="action-btn" data-edit-daily="${row.id}">Edit</button>
        <button class="action-btn danger" data-delete-daily="${row.id}">Delete</button>
      </td>
    `;
    dailyTable.appendChild(tr);
  });
};

const refreshResponses = async () => {
  const rows = await fetchJson("/api/responses");
  responseTable.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.user_message_time}</td>
      <td>${row.reply_time}</td>
      <td>${toMinutes(row.response_ms)}</td>
      <td>
        <button class="action-btn" data-edit-response="${row.id}">Edit</button>
        <button class="action-btn danger" data-delete-response="${row.id}">Delete</button>
      </td>
    `;
    responseTable.appendChild(tr);
  });
};

const drawTicketsChart = (tickets) => {
  chartContext.clearRect(0, 0, ticketsChart.width, ticketsChart.height);
  if (!tickets.length) {
    chartContext.fillStyle = "#8b93a7";
    chartContext.fillText("No data yet", 20, 30);
    return;
  }

  const padding = 30;
  const maxValue = Math.max(...tickets.map((item) => item.tickets_replied));
  const barWidth = (ticketsChart.width - padding * 2) / tickets.length;

  tickets.forEach((item, index) => {
    const barHeight = ((item.tickets_replied || 0) / maxValue) * (ticketsChart.height - padding * 2);
    const x = padding + index * barWidth;
    const y = ticketsChart.height - padding - barHeight;

    chartContext.fillStyle = "#5c9dff";
    chartContext.fillRect(x, y, barWidth - 6, barHeight);

    chartContext.fillStyle = "#8b93a7";
    chartContext.font = "10px sans-serif";
    chartContext.fillText(item.date, x, ticketsChart.height - 10);
  });
};

const refreshAnalytics = async () => {
  const analytics = await fetchJson("/api/analytics");
  avgResponse.textContent = `${toMinutes(analytics.overall?.avg_response_ms || 0)} min`;
  fastestResponse.textContent = `${toMinutes(analytics.overall?.fastest_response_ms || 0)} min`;
  slowestResponse.textContent = `${toMinutes(analytics.overall?.slowest_response_ms || 0)} min`;
  totalResponses.textContent = analytics.overall?.total_responses || 0;

  responseAnalytics.innerHTML = "";
  analytics.perDayResponses.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${toMinutes(row.avg_response_ms)} </td>
      <td>${row.total_responses}</td>
    `;
    responseAnalytics.appendChild(tr);
  });

  ticketsAnalytics.innerHTML = "";
  analytics.ticketsPerDay.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.tickets_replied}</td>
    `;
    ticketsAnalytics.appendChild(tr);
  });

  drawTicketsChart([...analytics.ticketsPerDay].reverse());
};

const refreshRangeTotals = async () => {
  const startDate = rangeStart.value;
  const endDate = rangeEnd.value;
  if (!startDate || !endDate) {
    rangeTotal.textContent = "0";
    return;
  }
  const analytics = await fetchJson(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
  rangeTotal.textContent = analytics.totalTicketsInRange;
};

const openEditPrompt = async (label, initialValue) =>
  new Promise((resolve) => {
    const result = window.prompt(label, initialValue);
    resolve(result);
  });

const handleTableClick = async (event) => {
  const { target } = event;
  if (target.dataset.deleteDaily) {
    await fetchJson(`/api/daily/${target.dataset.deleteDaily}`, { method: "DELETE" });
    await Promise.all([refreshDaily(), refreshAnalytics(), refreshRangeTotals()]);
  }
  if (target.dataset.deleteResponse) {
    await fetchJson(`/api/responses/${target.dataset.deleteResponse}`, { method: "DELETE" });
    await Promise.all([refreshResponses(), refreshAnalytics()]);
  }
  if (target.dataset.editDaily) {
    const id = target.dataset.editDaily;
    const date = await openEditPrompt("Date (YYYY-MM-DD)", today);
    const tickets = await openEditPrompt("Tickets replied", "0");
    const start = await openEditPrompt("Work start (HH:MM)", "09:00");
    const end = await openEditPrompt("Work end (HH:MM)", "17:00");
    if (date && tickets && start && end) {
      await fetchJson(`/api/daily/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          ticketsReplied: tickets,
          workStart: start,
          workEnd: end
        })
      });
      await Promise.all([refreshDaily(), refreshAnalytics(), refreshRangeTotals()]);
    }
  }
  if (target.dataset.editResponse) {
    const id = target.dataset.editResponse;
    const date = await openEditPrompt("Date (YYYY-MM-DD)", today);
    const userTime = await openEditPrompt("User message time (YYYY-MM-DDTHH:MM)", "");
    const replyTime = await openEditPrompt("Reply time (YYYY-MM-DDTHH:MM)", "");
    if (date && userTime && replyTime) {
      await fetchJson(`/api/responses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          userMessageTime: userTime,
          replyTime
        })
      });
      await Promise.all([refreshResponses(), refreshAnalytics()]);
    }
  }
};

dailyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    date: dailyDate.value,
    ticketsReplied: document.getElementById("tickets-replied").value,
    workStart: document.getElementById("work-start").value,
    workEnd: document.getElementById("work-end").value
  };
  await fetchJson("/api/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  dailyForm.reset();
  dailyDate.value = today;
  await Promise.all([refreshDaily(), refreshAnalytics(), refreshRangeTotals()]);
});

responseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    date: responseDate.value,
    userMessageTime: document.getElementById("user-message-time").value,
    replyTime: document.getElementById("reply-time").value
  };
  await fetchJson("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  responseForm.reset();
  responseDate.value = today;
  await Promise.all([refreshResponses(), refreshAnalytics()]);
});

document.getElementById("export-daily").addEventListener("click", () => {
  window.location.href = "/api/export/daily";
});

document.getElementById("export-responses").addEventListener("click", () => {
  window.location.href = "/api/export/responses";
});

document.getElementById("range-refresh").addEventListener("click", refreshRangeTotals);

dailyTable.addEventListener("click", handleTableClick);
responseTable.addEventListener("click", handleTableClick);

const init = async () => {
  await Promise.all([refreshDaily(), refreshResponses(), refreshAnalytics(), refreshRangeTotals()]);
};

init();
