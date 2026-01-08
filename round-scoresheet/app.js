/* global m */

const STORAGE_KEY = "card_scoresheet_round_scoresheet"

const defaultState = () => ({
  players: [
    { id: 1, name: "Player 1" },
    { id: 2, name: "Player 2" },
  ],
  rounds: [],
  nextPlayerId: 3,
  nextRoundId: 1,
})

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.players)) return defaultState()
    return {
      players: parsed.players,
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      nextPlayerId:
        typeof parsed.nextPlayerId === "number"
          ? parsed.nextPlayerId
          : parsed.players.length + 1,
      nextRoundId:
        typeof parsed.nextRoundId === "number"
          ? parsed.nextRoundId
          : (Array.isArray(parsed.rounds) ? parsed.rounds.length : 0) + 1,
    }
  } catch (err) {
    return defaultState()
  }
}

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const state = loadState()
const uiState = {
  draftScores: {},
}

const ensureDraftScores = () => {
  state.players.forEach((player) => {
    if (!(player.id in uiState.draftScores)) {
      uiState.draftScores[player.id] = ""
    }
  })
}

const clearDraftScores = () => {
  uiState.draftScores = {}
  ensureDraftScores()
}

const totalsFor = (rounds, players) => {
  const totals = {}
  players.forEach((player) => {
    totals[player.id] = 0
  })
  rounds.forEach((round) => {
    players.forEach((player) => {
      const value = round.scores[player.id]
      totals[player.id] += Number.isFinite(value) ? value : 0
    })
  })
  return totals
}

const RoundScoresheetApp = {
  oninit: () => {
    saveState(state)
  },
  view: () => {
    const totals = totalsFor(state.rounds, state.players)
    ensureDraftScores()

    const addRound = (event) => {
      event.preventDefault()
      const scores = {}
      let hasScore = false
      state.players.forEach((player) => {
        const raw = uiState.draftScores[player.id]
        const value = raw === "" ? 0 : Number(raw)
        if (raw !== "") hasScore = true
        scores[player.id] = Number.isNaN(value) ? 0 : value
      })
      if (!hasScore) return
      state.rounds.push({
        id: state.nextRoundId++,
        scores,
      })
      clearDraftScores()
      saveState(state)
    }

    return m("div.stack", [
      m("div.page-header", [
        m("a.back-link", { href: "../index.html" }, "Back to main page"),
        m("h1", "Round Scoresheet"),
        m(
          "p",
          "A simple round-by-round scoresheet for any card game. All data stays in this browser."
        ),
      ]),
      m("section.card", [
        m("h2", "Players"),
        state.players.map((player) =>
          m("div.player-row", { key: player.id }, [
            m("input.text-input", {
              value: player.name,
              oninput: (event) => {
                player.name = event.target.value
                saveState(state)
              },
              "aria-label": "Player name",
            }),
            state.players.length > 2
              ? m(
                  "button.secondary-button",
                  {
                    type: "button",
                    onclick: () => {
                      state.players = state.players.filter(
                        (item) => item.id !== player.id
                      )
                      state.rounds = state.rounds.map((round) => {
                        const nextScores = { ...round.scores }
                        delete nextScores[player.id]
                        return { ...round, scores: nextScores }
                      })
                      delete uiState.draftScores[player.id]
                      saveState(state)
                    },
                  },
                  "Remove"
                )
              : null,
          ])
        ),
        m(
          "button.secondary-button",
          {
            type: "button",
            onclick: () => {
              state.players.push({
                id: state.nextPlayerId++,
                name: `Player ${state.nextPlayerId - 1}`,
              })
              ensureDraftScores()
              saveState(state)
            },
          },
          "Add player"
        ),
      ]),
      m("section.card", [
        m("div.section-header", [
          m("h2", "Scoreboard"),
          m(
            "button.secondary-button",
            {
              type: "button",
              onclick: () => {
                state.rounds = []
                state.nextRoundId = 1
                saveState(state)
              },
            },
            "Clear rounds"
          ),
        ]),
        m(
          "form.round-form",
          {
            onsubmit: addRound,
          },
          m("div.table-wrap", [
            m("table.score-table", [
              m("thead", [
                m("tr", [
                  m("th", "Round"),
                  ...state.players.map((player) => m("th", player.name)),
                ]),
              ]),
              m("tbody", [
                ...state.rounds.map((round) =>
                  m("tr", { key: round.id }, [
                    m("td", `#${round.id}`),
                    ...state.players.map((player) =>
                      m("td", round.scores[player.id] ?? 0)
                    ),
                  ])
                ),
                m("tr", { key: "input-row" }, [
                  m("td", [
                    m("div", "Next"),
                    m(
                      "button.primary-button",
                      { type: "submit" },
                      "Add round"
                    ),
                  ]),
                  ...state.players.map((player) =>
                    m("td", [
                      m("input.score-input", {
                        type: "number",
                        inputmode: "numeric",
                        value: uiState.draftScores[player.id],
                        oninput: (event) => {
                          uiState.draftScores[player.id] = event.target.value
                        },
                        placeholder: "0",
                      }),
                    ])
                  ),
                ]),
              ]),
              m("tfoot", [
                m("tr", [
                  m("td", "Total"),
                  ...state.players.map((player) => m("td", totals[player.id])),
                ]),
              ]),
            ]),
          ])
        ),
      ]),
    ])
  },
}

m.mount(document.getElementById("app"), RoundScoresheetApp)
