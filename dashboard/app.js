// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the filters, the per-protocol detail
// drawer and the live-token view. No network: every byte it shows is in data.js.
//
// The model lives here twice over, on purpose: impliedValueOf recomputes a row
// from the snapshot figures and checks the number board.json carries, and
// farmSteps derives the plan the detail drawer shows from the same category,
// chains, TVL and age the program used — so the page, the board and the code
// are visibly the same arithmetic. No protocol name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var $ = function (id) { return document.getElementById(id); };
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------- the model
  // implied = round(tvl x base x (1 + clamp(change_7d) / 100 x weight) x
  //   (maturity_floor + min(age, maturity_days) / maturity_days x maturity_range)
  //   x (1 + breadth_per_chain x min(chains - 1, breadth_max_chains)))
  function impliedValueOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_chains);
    var breadth = 1 + model.breadth_per_chain * extra;
    return { value: Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth)), growth: growth, growthMult: growthMult, maturity: maturity, breadth: breadth };
  }

  // ------------------------------------------------------------- the farm plan
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function gasToken(chain) {
    var map = { Ethereum: 'ETH', Base: 'ETH', Arbitrum: 'ETH', Optimism: 'ETH', Ink: 'ETH', Linea: 'ETH', Scroll: 'ETH', 'zkSync Era': 'ETH', Blast: 'ETH', Mode: 'ETH', Fraxtal: 'ETH', Solana: 'SOL', Binance: 'BNB', Avalanche: 'AVAX', Polygon: 'POL', Tron: 'TRX', Bitcoin: 'BTC', Bittensor: 'TAO', 'Hyperliquid L1': 'HYPE', Monad: 'MON', Plasma: 'XPL', Sei: 'SEI', Sui: 'SUI', Aptos: 'APT', Near: 'NEAR', Cosmos: 'ATOM', Fantom: 'FTM', Gnosis: 'xDAI', Starknet: 'STRK', Mantle: 'MNT', Berachain: 'BERA', Sonic: 'S', Cronos: 'CRO', Kava: 'KAVA', Osmosis: 'OSMO', Injective: 'INJ', Celestia: 'TIA', Cardano: 'ADA', Ripple: 'XRP', Dogecoin: 'DOGE', Litecoin: 'LTC', Stellar: 'XLM', TON: 'TON' };
    return map[chain] || "the chain's gas token";
  }
  function gasUsd(chain) {
    var map = { Ethereum: 8, Solana: 0.05, Base: 0.3, Arbitrum: 0.5, Optimism: 0.4, Ink: 0.3, Linea: 0.3, Scroll: 0.3, 'zkSync Era': 0.5, Blast: 0.3, Mode: 0.3, Fraxtal: 0.3, Binance: 0.3, Avalanche: 0.8, Polygon: 0.1, Tron: 1, Bitcoin: 2, Bittensor: 0.5, 'Hyperliquid L1': 0.1, Monad: 0.05, Plasma: 0.1, Sei: 0.05, Sui: 0.05, Aptos: 0.05, Near: 0.05, Cosmos: 0.1, Fantom: 0.2, Gnosis: 0.05, Starknet: 0.5, Mantle: 0.2, Berachain: 0.1, Sonic: 0.1, Cronos: 0.2, Kava: 0.1, Osmosis: 0.1, Injective: 0.05, Celestia: 0.05, Cardano: 0.3, Ripple: 0.01, Dogecoin: 0.1, Litecoin: 0.1, Stellar: 0.01, TON: 0.05 };
    return map[chain] === undefined ? 1.5 : map[chain];
  }
  function money(n) { return n < 1 ? '$' + n.toFixed(2) : '$' + Math.round(n); }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionsFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return [
      'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' as collateral and borrow a small amount against it, so the position shows both sides of the market.',
      'Repay a quarter of the borrow and borrow it again a week later, so the loan history shows two full cycles instead of one deposit.'
    ];
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return [
      "Provide $" + capital + " of liquidity to " + name + "'s largest pool on " + chain + ' and keep the position open.',
      'Swap $25 through the pool on two different days, so the wallet shows trading activity as well as liquidity.'
    ];
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return [
      "Deposit $" + capital + " of USDC into " + name + "'s highest-TVL vault on " + chain + ' and keep the shares.',
      "Claim the vault's yield once and deposit it straight back in, so the position compounds instead of sitting idle."
    ];
    if (c.indexOf('risk curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0) return [
      'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the wallet.',
      'Put a second, smaller deposit of $25 into a different vault run by the same curator, so the wallet is spread across two of its products.'
    ];
    if (c.indexOf('rwa') >= 0 || c.indexOf('basis trading') >= 0) return [
      "Mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the wallet.',
      "Check the asset's yield accrual once a week and top the position up by $25 after the first month."
    ];
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return [
      'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position, sized so a move against it cannot liquidate the account.',
      'Close the hedge and open a fresh one the following week, so the account shows two separate trading sessions.'
    ];
    if (c.indexOf('stable') >= 0) return [
      'Mint $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' against collateral and hold the minted coins.',
      'Repay a quarter of the minted stablecoins and mint them again, so the mint history shows more than one cycle.'
    ];
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return [
      "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token in the wallet.',
      "Restake the receipt once through the protocol's own restaking route, so the wallet holds both the stake and the restake."
    ];
    if (c.indexOf('prediction') >= 0) return [
      'Fund $' + capital + ' and place one market position on ' + name + ', on a market that resolves within the month.',
      'Settle that market and open a second, smaller position on a different market the week after.'
    ];
    if (c.indexOf('chain') >= 0) return [
      'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in one app on that chain.',
      'Bridge $25 back a week later, so the wallet shows activity in both directions.'
    ];
    return [
      'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.',
      "Use the protocol's main feature a second time a week later, so the wallet shows repeat activity instead of a single visit."
    ];
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasUsd(chain);
    var token = gasToken(chain);
    var pair = actionsFor(p, capital, chain);
    var weeklyGas = Math.max(gas, 0.05);
    return [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, fund it with a little ' + token + ' for gas on ' + chain + ', and keep its seed phrase offline.', cost: 'under ' + money(gas * 2) + ' of gas for the first transaction', time: '5 minutes' },
      { text: pair[0], cost: '$' + capital + ' of capital and about ' + money(gas) + ' of gas', time: '15 minutes to set up' },
      { text: pair[1], cost: 'about ' + money(gas * 2) + ' of gas', time: '10 minutes' },
      { text: 'Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet stays active across snapshots.', cost: 'about ' + money(weeklyGas) + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot, and do not withdraw early.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page from the link it publishes and check what the wallet earned.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, and set a monthly reminder to re-check the protocol for a token announcement.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // ------------------------------------------------------------------ state
  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.wl = true;
    if (params.get('tab') === 'live') state.tab = 'live';
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('scroll')) state.scroll = params.get('scroll');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // ------------------------------------------------------------------ render
  function renderMeta() {
    $('meta-asof').textContent = DATA.as_of;
    $('meta-model').textContent = DATA.model_version;
    $('hero-count').textContent = DATA.board_size;
    $('stat-watch').textContent = DATA.watchlist_size + ' / ' + DATA.watchlist_size;
    $('stat-board').textContent = String(DATA.board_size);
    $('stat-early').textContent = String(DATA.early_size);
    $('stat-live').textContent = String(DATA.live_total);
    $('foot-asof').textContent = DATA.as_of;
    $('foot-source').textContent = DATA.source;
    var m = DATA.model;
    $('formula').textContent = 'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.breadth_per_chain + ' x min(chains - 1, ' + m.breadth_max_chains + ')) )';
  }

  function renderSpotlight() {
    var wrap = $('spotlight');
    wrap.innerHTML = '';
    DATA.rows.slice(0, 3).forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.innerHTML =
        '<span class="rank">RANK ' + r.rank + ' · ' + (r.watchlist ? 'WATCHLIST' : 'EARLY') + '</span>' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<span class="meta">' + esc(r.category || 'Other') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') + '</span>' +
        '<span class="value">' + fmtUsd(r.implied_value_usd) + ' <small>implied</small></span>' +
        '<span class="facts"><span>TVL ' + fmtUsd(r.tvl_usd) + '</span><span>7d ' + fmtPct(r.change_7d) + '</span><span>Age ' + fmtAge(r.age_days) + '</span></span>' +
        '<span class="go">View the farm plan &rarr;</span>';
      b.addEventListener('click', function () { openDetail(r.slug); });
      wrap.appendChild(b);
    });
  }

  function fillSelect(id, values) {
    var sel = $(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    sel.value = id === 'category' ? state.category : state.chain;
  }

  function sortButton(key, label) {
    var active = state.sort === key;
    return '<button type="button" data-sort="' + key + '">' + label + (active ? ' <span class="arrow" aria-hidden="true">' + (state.dir < 0 ? '&#8595;' : '&#8593;') + '</span>' : '') + '</button>';
  }

  function renderTable() {
    var table = $('board-table');
    var head = table.querySelector('thead');
    var body = $('board-body');
    var empty = $('empty');
    var caption = table.querySelector('caption');
    if (state.tab === 'live') {
      caption.textContent = 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.';
      head.innerHTML = '<tr><th scope="col">Status</th><th scope="col">Protocol</th><th scope="col">TVL</th><th scope="col">7d</th><th scope="col">Market cap</th><th scope="col">Token</th></tr>';
      body.innerHTML = DATA.live.map(function (r) {
        return '<tr><td class="num">live</td><td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') + '</span></div></td>' +
          '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num">' + fmtUsd(r.mcap_usd) + '</td><td><span class="tag live">already trades</span></td></tr>';
      }).join('');
      empty.hidden = true;
      $('count').textContent = DATA.live.length + ' live-token protocols shown (top ' + DATA.live.length + ' by market cap)';
      return;
    }
    caption.textContent = 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.';
    head.innerHTML = '<tr><th scope="col">' + sortButton('implied', 'Rank') + '</th><th scope="col">' + sortButton('name', 'Protocol') + '</th><th scope="col">' + sortButton('tvl', 'TVL') + '</th><th scope="col">' + sortButton('growth', '7d') + '</th><th scope="col">' + sortButton('age', 'Age') + '</th><th scope="col">' + sortButton('implied', 'Implied value') + '</th><th scope="col">Farm from</th><th scope="col">Token</th></tr>';
    var list = sortedRows(filteredRows());
    var max = list.length ? list[0].implied_value_usd || 1 : 1;
    if (list.length === 0) {
      body.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      body.innerHTML = list.map(function (r) {
        var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
        var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
        var pct = Math.max(3, Math.round((r.implied_value_usd / max) * 100));
        return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug ? 'true' : 'false') + '" tabindex="0" class="' + (r.rank <= 3 ? 'top3' : '') + '">' +
          '<td class="num"><span class="rank-badge">' + r.rank + '</span></td>' +
          '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') + '</span></div></td>' +
          '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
          '<td class="num ' + growthClass + '">' + growth + '</td>' +
          '<td class="num">' + fmtAge(r.age_days) + '</td>' +
          '<td><div class="implied"><div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div><span class="num">' + fmtUsd(r.implied_value_usd) + '</span></div></td>' +
          '<td class="num">$' + r.capital_usd + ' <span class="sub">capital</span></td>' +
          '<td><span class="tag ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'watchlist' : 'early') + '</span></td></tr>';
      }).join('');
      Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
        tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
        });
      });
    }
    $('count').textContent = list.length + ' of ' + DATA.board_size + ' rows shown';
  }

  // ------------------------------------------------------------------ detail
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var calc = impliedValueOf(row, DATA.model);
    $('detail-rank').textContent = 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.watchlist ? 'Watchlist' : 'Early radar');
    $('detail-title').textContent = row.name;
    $('detail-sub').textContent = (row.category || 'Other') + ' on ' + ((row.chains || []).join(', ') || 'an unnamed chain') + ' · records no token';
    $('detail-model').innerHTML =
      '<div><dt>TVL</dt><dd>' + fmtUsd(row.tvl_usd) + '</dd></div>' +
      '<div><dt>Seven-day growth</dt><dd>' + fmtPct(row.change_7d) + '</dd></div>' +
      '<div><dt>Age with no token</dt><dd>' + fmtAge(row.age_days) + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + (row.chains || []).length + '</dd></div>' +
      '<div><dt>Growth multiplier</dt><dd>' + row.growth_multiplier + '</dd></div>' +
      '<div><dt>Maturity multiplier</dt><dd>' + row.maturity_multiplier + '</dd></div>' +
      '<div><dt>Breadth multiplier</dt><dd>' + row.breadth_multiplier + '</dd></div>' +
      '<div><dt>Implied value</dt><dd>' + fmtUsd(row.implied_value_usd) + '</dd></div>';
    $('detail-check').textContent = 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(calc.value) +
      (calc.value === row.implied_value_usd ? ', the same number the board carries.' : ', which differs from the board: the data would be stale.') +
      ' This is an estimate, not a price.';
    var gas = gasUsd(chainOf(row));
    $('detail-budget').textContent = '· budget about $' + row.capital_usd + ' + ' + money(gas * 10) + ' gas';
    var steps = farmSteps(row);
    $('detail-steps').innerHTML = steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    $('detail').hidden = false;
    $('scrim').hidden = false;
    renderTable();
  }
  function closeDetail() {
    state.selected = null;
    writeHash();
    $('detail').hidden = true;
    $('scrim').hidden = true;
    renderTable();
  }

  // ------------------------------------------------------------------ wiring
  function render() {
    $('tab-pre').setAttribute('aria-pressed', state.tab === 'pre-token' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
    renderTable();
    if (state.selected && state.tab === 'pre-token') openDetail(state.selected);
    // Deep links for screenshots and sharing: #scroll=controls jumps to the
    // board's controls and table, #scroll=model to the model section.
    if (state.scroll) {
      var target = state.scroll === 'model' ? document.querySelector('.model') : $('controls');
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }

  readHash();
  renderMeta();
  renderSpotlight();
  fillSelect('category', Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort());
  fillSelect('chain', Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort());
  var q = $('q');
  q.value = state.q;
  q.addEventListener('input', function () { state.q = q.value; writeHash(); renderTable(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); renderTable(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderTable(); });
  $('watchlist-only').checked = state.wl;
  $('watchlist-only').addEventListener('change', function (e) { state.wl = e.target.checked; writeHash(); renderTable(); });
  $('tab-pre').addEventListener('click', function () { state.tab = 'pre-token'; writeHash(); render(); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; writeHash(); render(); });
  $('clear-filters').addEventListener('click', function () {
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false;
    q.value = ''; $('category').value = 'all'; $('chain').value = 'all'; $('watchlist-only').checked = false;
    writeHash(); renderTable();
  });
  document.querySelector('table').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-sort]');
    if (!btn) return;
    var key = btn.getAttribute('data-sort');
    if (state.sort === key) state.dir = -state.dir;
    else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
    renderTable();
  });
  $('detail-close').addEventListener('click', closeDetail);
  $('scrim').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('detail').hidden) closeDetail();
  });
  render();
})();
