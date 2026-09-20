(function () {
  function emptyVerifiedSlots() {
    return `
      <div class="empty-state">
        <div>
          <h3>No verified parking slots yet</h3>
          <p>Owner-created slots will appear here after admin approval.</p>
        </div>
      </div>
    `;
  }

  async function renderHomeSlots() {
    const target = document.querySelector("#homeSlots");
    if (!target || !window.ParkrStore || !window.ParkrUtils) return;
    try {
      const slots = await ParkrStore.listSlots({ publicOnly: true });
      target.innerHTML = slots.length
        ? slots.map((slot) => ParkrUtils.renderSlotCard(slot)).join("")
        : emptyVerifiedSlots();
    } catch (error) {
      target.innerHTML = emptyVerifiedSlots();
    }
  }

  document.addEventListener("DOMContentLoaded", renderHomeSlots);
})();
