<?php
/**
 * Test for calcPmGoalScore (Impact OS PM axis B).
 * Seeds projects + deals for a PM, runs the SAME SQL as calcPmGoalScore, asserts,
 * then cleans up. Run: php scripts/test-pm-goal-score.php
 * See docs/superpowers/specs/2026-06-26-pm-goal-score-design.md
 */
require_once __DIR__ . '/../api/config.php';
$db = getDB();

$TID = 'tenant-default';
$PM  = 'user-001';                 // position = 'Project Manager'
$START = '2026-06-01'; $END = '2026-06-30';
$UPD = '2026-06-15 10:00:00';      // status-change timestamp inside the period
$MARK = 'PMTEST_' . uniqid();

$company = $db->query("SELECT id FROM companies WHERE tenant_id=".$db->quote($TID)." LIMIT 1")->fetchColumn();
if (!$company) { fwrite(STDERR, "no company in tenant\n"); exit(1); }

function pid($m,$n){ return substr(md5($m.$n),0,8).'-0000-4000-8000-'.substr(md5($m.$n.'x'),0,12); }

// ── Replicate calcPmGoalScore exactly ────────────────────────────────────────
function calcPmGoalScore(PDO $db, string $userId, string $tenantId, string $start, string $end): ?float {
    $dStmt = $db->prepare("
        SELECT SUM(CASE WHEN so.stage='won' THEN 1 ELSE 0 END) AS won,
               SUM(CASE WHEN so.stage='lost' THEN 1 ELSE 0 END) AS lost
        FROM sales_opportunities so
        JOIN projects p ON p.id=so.project_id AND p.manager_id=? AND p.tenant_id=?
        WHERE so.tenant_id=? AND so.stage IN ('won','lost')
          AND COALESCE(so.actual_close_date, DATE(so.updated_at)) BETWEEN ? AND ?");
    $dStmt->execute([$userId,$tenantId,$tenantId,$start,$end]);
    $d=$dStmt->fetch(); $won=(int)($d['won']??0); $lost=(int)($d['lost']??0);
    $pStmt = $db->prepare("
        SELECT SUM(CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END) AS finished,
               SUM(CASE WHEN status='completed' AND (original_end_date IS NULL OR end_date<=original_end_date) THEN 1 ELSE 0 END) AS on_time
        FROM projects WHERE manager_id=? AND tenant_id=? AND status IN ('completed','cancelled')
          AND DATE(updated_at) BETWEEN ? AND ?");
    $pStmt->execute([$userId,$tenantId,$start,$end]);
    $p=$pStmt->fetch(); $finished=(int)($p['finished']??0); $onTime=(int)($p['on_time']??0);
    $closed=$won+$lost; $hasD=$closed>0; $hasP=$finished>0;
    if(!$hasD && !$hasP) return null;
    $wr=$hasD?($won/$closed):null; $or=$hasP?($onTime/$finished):null;
    if($wr!==null && $or!==null) $s=$wr*50+$or*50;
    elseif($wr!==null) $s=$wr*100; else $s=$or*100;
    return round($s,1);
}

function insProject($db,$id,$tid,$pm,$name,$status,$end,$origEnd,$upd){
    $db->prepare("INSERT INTO projects (id,tenant_id,user_id,manager_id,name,status,start_date,end_date,original_end_date,updated_at,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)")
       ->execute([$id,$tid,$pm,$pm,$name,$status,'2026-06-01',$end,$origEnd,$upd,$upd]);
}
function insDeal($db,$id,$tid,$comp,$pm,$proj,$stage,$close,$upd){
    $db->prepare("INSERT INTO sales_opportunities (id,tenant_id,company_id,name,assigned_to,created_by,project_id,stage,value,actual_close_date,updated_at,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
       ->execute([$id,$tid,$comp,'deal',$pm,$pm,$proj,$stage,1000,$close,$upd,$upd]);
}

$pass=true;
function check($label,$got,$exp){ global $pass; $ok=($got===$exp); $pass=$pass&&$ok;
    echo ($ok?'PASS':'FAIL')." | $label: got=".var_export($got,true)." exp=".var_export($exp,true)."\n"; }

try {
    $pOnTime=pid($MARK,'p1'); $pLate=pid($MARK,'p2'); $pCancel=pid($MARK,'p3');
    insProject($db,$pOnTime,$TID,$PM,$MARK.' ontime','completed','2026-06-10','2026-06-20',$UPD); // on-time
    insProject($db,$pLate,  $TID,$PM,$MARK.' late',  'completed','2026-06-20','2026-06-10',$UPD); // late
    insProject($db,$pCancel,$TID,$PM,$MARK.' cancel','cancelled','2026-06-15','2026-06-15',$UPD); // cancelled

    // Full case: won=1 lost=1 -> win_rate .5 ; finished=3 on_time=1 -> .3333 ; score=25+16.67=41.7
    insDeal($db,pid($MARK,'d1'),$TID,$company,$PM,$pOnTime,'won','2026-06-15',$UPD);
    insDeal($db,pid($MARK,'d2'),$TID,$company,$PM,$pLate,'lost','2026-06-15',$UPD);
    check('full (win .5, ontime 1/3)', calcPmGoalScore($db,$PM,$TID,$START,$END), 41.7);

    // Projects only (remove deals): ontime_rate 1/3 -> 33.3
    $db->exec("DELETE FROM sales_opportunities WHERE name='deal' AND created_by='$PM' AND project_id IN ('$pOnTime','$pLate','$pCancel')");
    check('projects only (1/3*100)', calcPmGoalScore($db,$PM,$TID,$START,$END), 33.3);

    // Deals only (remove projects from period by moving updated_at out): re-add deals, drop projects' period
    insDeal($db,pid($MARK,'d3'),$TID,$company,$PM,$pOnTime,'won','2026-06-15',$UPD);
    $db->exec("UPDATE projects SET updated_at='2026-05-01 10:00:00' WHERE id IN ('$pOnTime','$pLate','$pCancel')");
    check('deals only (1 won /1 *100)', calcPmGoalScore($db,$PM,$TID,$START,$END), 100.0);

    // No data: move deals out of period too
    $db->exec("UPDATE sales_opportunities SET actual_close_date='2026-05-01', updated_at='2026-05-01 10:00:00' WHERE created_by='$PM' AND project_id IN ('$pOnTime','$pLate','$pCancel')");
    check('no data -> null', calcPmGoalScore($db,$PM,$TID,$START,$END), null);

} finally {
    $db->exec("DELETE FROM sales_opportunities WHERE name='deal' AND created_by='$PM' AND project_id LIKE '".substr(md5($MARK.'p1'),0,8)."%' OR (name='deal' AND created_by='$PM' AND value=1000 AND DATE(created_at)='2026-06-15')");
    $db->exec("DELETE FROM projects WHERE name LIKE ".$db->quote($MARK.'%'));
    // belt-and-suspenders: delete any test deals linked to the test projects
    foreach (['p1','p2','p3'] as $n) { $db->exec("DELETE FROM sales_opportunities WHERE project_id='".pid($MARK,$n)."'"); }
    echo "cleanup done\n";
}
echo $pass ? "ALL PASS\n" : "FAILED\n";
exit($pass?0:1);
