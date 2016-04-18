import { isPresent } from 'angular2/src/facade/lang';
import { ListWrapper } from 'angular2/src/facade/collection';
import * as o from '../output/output_ast';
class _DebugState {
    constructor(nodeIndex, sourceAst) {
        this.nodeIndex = nodeIndex;
        this.sourceAst = sourceAst;
    }
}
var NULL_DEBUG_STATE = new _DebugState(null, null);
export class CompileMethod {
    constructor(_view) {
        this._view = _view;
        this._newState = NULL_DEBUG_STATE;
        this._currState = NULL_DEBUG_STATE;
        this._bodyStatements = [];
        this._debugEnabled = this._view.genConfig.genDebugInfo;
    }
    _updateDebugContextIfNeeded() {
        if (this._newState.nodeIndex !== this._currState.nodeIndex ||
            this._newState.sourceAst !== this._currState.sourceAst) {
            var expr = this._updateDebugContext(this._newState);
            if (isPresent(expr)) {
                this._bodyStatements.push(expr.toStmt());
            }
        }
    }
    _updateDebugContext(newState) {
        this._currState = this._newState = newState;
        if (this._debugEnabled) {
            var sourceLocation = isPresent(newState.sourceAst) ? newState.sourceAst.sourceSpan.start : null;
            return o.THIS_EXPR.callMethod('debug', [
                o.literal(newState.nodeIndex),
                isPresent(sourceLocation) ? o.literal(sourceLocation.line) : o.NULL_EXPR,
                isPresent(sourceLocation) ? o.literal(sourceLocation.col) : o.NULL_EXPR
            ]);
        }
        else {
            return null;
        }
    }
    resetDebugInfoExpr(nodeIndex, templateAst) {
        var res = this._updateDebugContext(new _DebugState(nodeIndex, templateAst));
        return isPresent(res) ? res : o.NULL_EXPR;
    }
    resetDebugInfo(nodeIndex, templateAst) {
        this._newState = new _DebugState(nodeIndex, templateAst);
    }
    addStmt(stmt) {
        this._updateDebugContextIfNeeded();
        this._bodyStatements.push(stmt);
    }
    addStmts(stmts) {
        this._updateDebugContextIfNeeded();
        ListWrapper.addAll(this._bodyStatements, stmts);
    }
    finish() { return this._bodyStatements; }
    isEmpty() { return this._bodyStatements.length === 0; }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZV9tZXRob2QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaWZmaW5nX3BsdWdpbl93cmFwcGVyLW91dHB1dF9wYXRoLTEzZnFrdjRpLnRtcC9hbmd1bGFyMi9zcmMvY29tcGlsZXIvdmlld19jb21waWxlci9jb21waWxlX21ldGhvZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiT0FBTyxFQUFDLFNBQVMsRUFBVSxNQUFNLDBCQUEwQjtPQUNwRCxFQUFhLFdBQVcsRUFBQyxNQUFNLGdDQUFnQztPQUUvRCxLQUFLLENBQUMsTUFBTSxzQkFBc0I7QUFLekM7SUFDRSxZQUFtQixTQUFpQixFQUFTLFNBQXNCO1FBQWhELGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFhO0lBQUcsQ0FBQztBQUN6RSxDQUFDO0FBRUQsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFFbkQ7SUFRRSxZQUFvQixLQUFrQjtRQUFsQixVQUFLLEdBQUwsS0FBSyxDQUFhO1FBUDlCLGNBQVMsR0FBZ0IsZ0JBQWdCLENBQUM7UUFDMUMsZUFBVSxHQUFnQixnQkFBZ0IsQ0FBQztRQUkzQyxvQkFBZSxHQUFrQixFQUFFLENBQUM7UUFHMUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUM7SUFDekQsQ0FBQztJQUVPLDJCQUEyQjtRQUNqQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVM7WUFDdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQzNELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDcEQsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDM0MsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsUUFBcUI7UUFDL0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUM1QyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLGNBQWMsR0FDZCxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7WUFFL0UsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRTtnQkFDckMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUM3QixTQUFTLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVM7Z0JBQ3hFLFNBQVMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUzthQUN4RSxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxTQUFpQixFQUFFLFdBQXdCO1FBQzVELElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUM1RSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzVDLENBQUM7SUFFRCxjQUFjLENBQUMsU0FBaUIsRUFBRSxXQUF3QjtRQUN4RCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksV0FBVyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRUQsT0FBTyxDQUFDLElBQWlCO1FBQ3ZCLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxRQUFRLENBQUMsS0FBb0I7UUFDM0IsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDbkMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCxNQUFNLEtBQW9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztJQUV4RCxPQUFPLEtBQWMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEUsQ0FBQztBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtpc1ByZXNlbnQsIGlzQmxhbmt9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge01hcFdyYXBwZXIsIExpc3RXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2NvbGxlY3Rpb24nO1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7VGVtcGxhdGVBc3R9IGZyb20gJy4uL3RlbXBsYXRlX2FzdCc7XG5cbmltcG9ydCB7Q29tcGlsZVZpZXd9IGZyb20gJy4vY29tcGlsZV92aWV3JztcblxuY2xhc3MgX0RlYnVnU3RhdGUge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbm9kZUluZGV4OiBudW1iZXIsIHB1YmxpYyBzb3VyY2VBc3Q6IFRlbXBsYXRlQXN0KSB7fVxufVxuXG52YXIgTlVMTF9ERUJVR19TVEFURSA9IG5ldyBfRGVidWdTdGF0ZShudWxsLCBudWxsKTtcblxuZXhwb3J0IGNsYXNzIENvbXBpbGVNZXRob2Qge1xuICBwcml2YXRlIF9uZXdTdGF0ZTogX0RlYnVnU3RhdGUgPSBOVUxMX0RFQlVHX1NUQVRFO1xuICBwcml2YXRlIF9jdXJyU3RhdGU6IF9EZWJ1Z1N0YXRlID0gTlVMTF9ERUJVR19TVEFURTtcblxuICBwcml2YXRlIF9kZWJ1Z0VuYWJsZWQ6IGJvb2xlYW47XG5cbiAgcHJpdmF0ZSBfYm9keVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF92aWV3OiBDb21waWxlVmlldykge1xuICAgIHRoaXMuX2RlYnVnRW5hYmxlZCA9IHRoaXMuX3ZpZXcuZ2VuQ29uZmlnLmdlbkRlYnVnSW5mbztcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZURlYnVnQ29udGV4dElmTmVlZGVkKCkge1xuICAgIGlmICh0aGlzLl9uZXdTdGF0ZS5ub2RlSW5kZXggIT09IHRoaXMuX2N1cnJTdGF0ZS5ub2RlSW5kZXggfHxcbiAgICAgICAgdGhpcy5fbmV3U3RhdGUuc291cmNlQXN0ICE9PSB0aGlzLl9jdXJyU3RhdGUuc291cmNlQXN0KSB7XG4gICAgICB2YXIgZXhwciA9IHRoaXMuX3VwZGF0ZURlYnVnQ29udGV4dCh0aGlzLl9uZXdTdGF0ZSk7XG4gICAgICBpZiAoaXNQcmVzZW50KGV4cHIpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlTdGF0ZW1lbnRzLnB1c2goZXhwci50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlRGVidWdDb250ZXh0KG5ld1N0YXRlOiBfRGVidWdTdGF0ZSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgdGhpcy5fY3VyclN0YXRlID0gdGhpcy5fbmV3U3RhdGUgPSBuZXdTdGF0ZTtcbiAgICBpZiAodGhpcy5fZGVidWdFbmFibGVkKSB7XG4gICAgICB2YXIgc291cmNlTG9jYXRpb24gPVxuICAgICAgICAgIGlzUHJlc2VudChuZXdTdGF0ZS5zb3VyY2VBc3QpID8gbmV3U3RhdGUuc291cmNlQXN0LnNvdXJjZVNwYW4uc3RhcnQgOiBudWxsO1xuXG4gICAgICByZXR1cm4gby5USElTX0VYUFIuY2FsbE1ldGhvZCgnZGVidWcnLCBbXG4gICAgICAgIG8ubGl0ZXJhbChuZXdTdGF0ZS5ub2RlSW5kZXgpLFxuICAgICAgICBpc1ByZXNlbnQoc291cmNlTG9jYXRpb24pID8gby5saXRlcmFsKHNvdXJjZUxvY2F0aW9uLmxpbmUpIDogby5OVUxMX0VYUFIsXG4gICAgICAgIGlzUHJlc2VudChzb3VyY2VMb2NhdGlvbikgPyBvLmxpdGVyYWwoc291cmNlTG9jYXRpb24uY29sKSA6IG8uTlVMTF9FWFBSXG4gICAgICBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcmVzZXREZWJ1Z0luZm9FeHByKG5vZGVJbmRleDogbnVtYmVyLCB0ZW1wbGF0ZUFzdDogVGVtcGxhdGVBc3QpOiBvLkV4cHJlc3Npb24ge1xuICAgIHZhciByZXMgPSB0aGlzLl91cGRhdGVEZWJ1Z0NvbnRleHQobmV3IF9EZWJ1Z1N0YXRlKG5vZGVJbmRleCwgdGVtcGxhdGVBc3QpKTtcbiAgICByZXR1cm4gaXNQcmVzZW50KHJlcykgPyByZXMgOiBvLk5VTExfRVhQUjtcbiAgfVxuXG4gIHJlc2V0RGVidWdJbmZvKG5vZGVJbmRleDogbnVtYmVyLCB0ZW1wbGF0ZUFzdDogVGVtcGxhdGVBc3QpIHtcbiAgICB0aGlzLl9uZXdTdGF0ZSA9IG5ldyBfRGVidWdTdGF0ZShub2RlSW5kZXgsIHRlbXBsYXRlQXN0KTtcbiAgfVxuXG4gIGFkZFN0bXQoc3RtdDogby5TdGF0ZW1lbnQpIHtcbiAgICB0aGlzLl91cGRhdGVEZWJ1Z0NvbnRleHRJZk5lZWRlZCgpO1xuICAgIHRoaXMuX2JvZHlTdGF0ZW1lbnRzLnB1c2goc3RtdCk7XG4gIH1cblxuICBhZGRTdG10cyhzdG10czogby5TdGF0ZW1lbnRbXSkge1xuICAgIHRoaXMuX3VwZGF0ZURlYnVnQ29udGV4dElmTmVlZGVkKCk7XG4gICAgTGlzdFdyYXBwZXIuYWRkQWxsKHRoaXMuX2JvZHlTdGF0ZW1lbnRzLCBzdG10cyk7XG4gIH1cblxuICBmaW5pc2goKTogby5TdGF0ZW1lbnRbXSB7IHJldHVybiB0aGlzLl9ib2R5U3RhdGVtZW50czsgfVxuXG4gIGlzRW1wdHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9ib2R5U3RhdGVtZW50cy5sZW5ndGggPT09IDA7IH1cbn1cbiJdfQ==