import { isBlank, isPresent, isFunction } from 'angular2/src/facade/lang';
import { BaseException } from 'angular2/src/facade/exceptions';
import { Map } from 'angular2/src/facade/collection';
import { PromiseWrapper } from 'angular2/src/facade/async';
import { RouteRule, RedirectRule, PathMatch } from './rules';
import { Route, AsyncRoute, AuxRoute, Redirect } from '../route_config/route_config_impl';
import { AsyncRouteHandler } from './route_handlers/async_route_handler';
import { SyncRouteHandler } from './route_handlers/sync_route_handler';
import { ParamRoutePath } from './route_paths/param_route_path';
import { RegexRoutePath } from './route_paths/regex_route_path';
/**
 * A `RuleSet` is responsible for recognizing routes for a particular component.
 * It is consumed by `RouteRegistry`, which knows how to recognize an entire hierarchy of
 * components.
 */
export class RuleSet {
    constructor() {
        this.rulesByName = new Map();
        // map from name to rule
        this.auxRulesByName = new Map();
        // map from starting path to rule
        this.auxRulesByPath = new Map();
        // TODO: optimize this into a trie
        this.rules = [];
        // the rule to use automatically when recognizing or generating from this rule set
        this.defaultRule = null;
    }
    /**
     * Configure additional rules in this rule set from a route definition
     * @returns {boolean} true if the config is terminal
     */
    config(config) {
        let handler;
        if (isPresent(config.name) && config.name[0].toUpperCase() != config.name[0]) {
            let suggestedName = config.name[0].toUpperCase() + config.name.substring(1);
            throw new BaseException(`Route "${config.path}" with name "${config.name}" does not begin with an uppercase letter. Route names should be CamelCase like "${suggestedName}".`);
        }
        if (config instanceof AuxRoute) {
            handler = new SyncRouteHandler(config.component, config.data);
            let routePath = this._getRoutePath(config);
            let auxRule = new RouteRule(routePath, handler, config.name);
            this.auxRulesByPath.set(routePath.toString(), auxRule);
            if (isPresent(config.name)) {
                this.auxRulesByName.set(config.name, auxRule);
            }
            return auxRule.terminal;
        }
        let useAsDefault = false;
        if (config instanceof Redirect) {
            let routePath = this._getRoutePath(config);
            let redirector = new RedirectRule(routePath, config.redirectTo);
            this._assertNoHashCollision(redirector.hash, config.path);
            this.rules.push(redirector);
            return true;
        }
        if (config instanceof Route) {
            handler = new SyncRouteHandler(config.component, config.data);
            useAsDefault = isPresent(config.useAsDefault) && config.useAsDefault;
        }
        else if (config instanceof AsyncRoute) {
            handler = new AsyncRouteHandler(config.loader, config.data);
            useAsDefault = isPresent(config.useAsDefault) && config.useAsDefault;
        }
        let routePath = this._getRoutePath(config);
        let newRule = new RouteRule(routePath, handler, config.name);
        this._assertNoHashCollision(newRule.hash, config.path);
        if (useAsDefault) {
            if (isPresent(this.defaultRule)) {
                throw new BaseException(`Only one route can be default`);
            }
            this.defaultRule = newRule;
        }
        this.rules.push(newRule);
        if (isPresent(config.name)) {
            this.rulesByName.set(config.name, newRule);
        }
        return newRule.terminal;
    }
    /**
     * Given a URL, returns a list of `RouteMatch`es, which are partial recognitions for some route.
     */
    recognize(urlParse) {
        var solutions = [];
        this.rules.forEach((routeRecognizer) => {
            var pathMatch = routeRecognizer.recognize(urlParse);
            if (isPresent(pathMatch)) {
                solutions.push(pathMatch);
            }
        });
        // handle cases where we are routing just to an aux route
        if (solutions.length == 0 && isPresent(urlParse) && urlParse.auxiliary.length > 0) {
            return [PromiseWrapper.resolve(new PathMatch(null, null, urlParse.auxiliary))];
        }
        return solutions;
    }
    recognizeAuxiliary(urlParse) {
        var routeRecognizer = this.auxRulesByPath.get(urlParse.path);
        if (isPresent(routeRecognizer)) {
            return [routeRecognizer.recognize(urlParse)];
        }
        return [PromiseWrapper.resolve(null)];
    }
    hasRoute(name) { return this.rulesByName.has(name); }
    componentLoaded(name) {
        return this.hasRoute(name) && isPresent(this.rulesByName.get(name).handler.componentType);
    }
    loadComponent(name) {
        return this.rulesByName.get(name).handler.resolveComponentType();
    }
    generate(name, params) {
        var rule = this.rulesByName.get(name);
        if (isBlank(rule)) {
            return null;
        }
        return rule.generate(params);
    }
    generateAuxiliary(name, params) {
        var rule = this.auxRulesByName.get(name);
        if (isBlank(rule)) {
            return null;
        }
        return rule.generate(params);
    }
    _assertNoHashCollision(hash, path) {
        this.rules.forEach((rule) => {
            if (hash == rule.hash) {
                throw new BaseException(`Configuration '${path}' conflicts with existing route '${rule.path}'`);
            }
        });
    }
    _getRoutePath(config) {
        if (isPresent(config.regex)) {
            if (isFunction(config.serializer)) {
                return new RegexRoutePath(config.regex, config.serializer);
            }
            else {
                throw new BaseException(`Route provides a regex property, '${config.regex}', but no serializer property`);
            }
        }
        if (isPresent(config.path)) {
            // Auxiliary routes do not have a slash at the start
            let path = (config instanceof AuxRoute && config.path.startsWith('/')) ?
                config.path.substring(1) :
                config.path;
            return new ParamRoutePath(path);
        }
        throw new BaseException('Route must provide either a path or regex property');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVsZV9zZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaWZmaW5nX3BsdWdpbl93cmFwcGVyLW91dHB1dF9wYXRoLTEzZnFrdjRpLnRtcC9hbmd1bGFyMi9zcmMvcm91dGVyL3J1bGVzL3J1bGVfc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJPQUFPLEVBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUMsTUFBTSwwQkFBMEI7T0FDaEUsRUFBQyxhQUFhLEVBQW1CLE1BQU0sZ0NBQWdDO09BQ3ZFLEVBQUMsR0FBRyxFQUE0QyxNQUFNLGdDQUFnQztPQUN0RixFQUFDLGNBQWMsRUFBQyxNQUFNLDJCQUEyQjtPQUVqRCxFQUFlLFNBQVMsRUFBRSxZQUFZLEVBQWMsU0FBUyxFQUFDLE1BQU0sU0FBUztPQUM3RSxFQUNMLEtBQUssRUFDTCxVQUFVLEVBQ1YsUUFBUSxFQUNSLFFBQVEsRUFFVCxNQUFNLG1DQUFtQztPQUVuQyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sc0NBQXNDO09BQy9ELEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxxQ0FBcUM7T0FHN0QsRUFBQyxjQUFjLEVBQUMsTUFBTSxnQ0FBZ0M7T0FDdEQsRUFBQyxjQUFjLEVBQUMsTUFBTSxnQ0FBZ0M7QUFNN0Q7Ozs7R0FJRztBQUNIO0lBQUE7UUFDRSxnQkFBVyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1FBRTNDLHdCQUF3QjtRQUN4QixtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1FBRTlDLGlDQUFpQztRQUNqQyxtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1FBRTlDLGtDQUFrQztRQUNsQyxVQUFLLEdBQW1CLEVBQUUsQ0FBQztRQUUzQixrRkFBa0Y7UUFDbEYsZ0JBQVcsR0FBYyxJQUFJLENBQUM7SUFtSmhDLENBQUM7SUFqSkM7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE1BQXVCO1FBQzVCLElBQUksT0FBTyxDQUFDO1FBRVosRUFBRSxDQUFD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QVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsTUFBTSxDQUFDLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLElBQUksYUFBYSxDQUNuQixxQ0FBcUMsTUFBTSxDQUFDLEtBQUssK0JBQStCLENBQUMsQ0FBQztZQUN4RixDQUFDO1FBQ0gsQ0FBQztRQUNELEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLG9EQUFvRDtZQUNwRCxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sWUFBWSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3ZELE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQztZQUMzQixNQUFNLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUNELE1BQU0sSUFBSSxhQUFhLENBQUMsb0RBQW9ELENBQUMsQ0FBQztJQUNoRixDQUFDO0FBQ0gsQ0FBQztBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtpc0JsYW5rLCBpc1ByZXNlbnQsIGlzRnVuY3Rpb259IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge0Jhc2VFeGNlcHRpb24sIFdyYXBwZWRFeGNlcHRpb259IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvZXhjZXB0aW9ucyc7XG5pbXBvcnQge01hcCwgTWFwV3JhcHBlciwgTGlzdFdyYXBwZXIsIFN0cmluZ01hcFdyYXBwZXJ9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvY29sbGVjdGlvbic7XG5pbXBvcnQge1Byb21pc2VXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2FzeW5jJztcblxuaW1wb3J0IHtBYnN0cmFjdFJ1bGUsIFJvdXRlUnVsZSwgUmVkaXJlY3RSdWxlLCBSb3V0ZU1hdGNoLCBQYXRoTWF0Y2h9IGZyb20gJy4vcnVsZXMnO1xuaW1wb3J0IHtcbiAgUm91dGUsXG4gIEFzeW5jUm91dGUsXG4gIEF1eFJvdXRlLFxuICBSZWRpcmVjdCxcbiAgUm91dGVEZWZpbml0aW9uXG59IGZyb20gJy4uL3JvdXRlX2NvbmZpZy9yb3V0ZV9jb25maWdfaW1wbCc7XG5cbmltcG9ydCB7QXN5bmNSb3V0ZUhhbmRsZXJ9IGZyb20gJy4vcm91dGVfaGFuZGxlcnMvYXN5bmNfcm91dGVfaGFuZGxlcic7XG5pbXBvcnQge1N5bmNSb3V0ZUhhbmRsZXJ9IGZyb20gJy4vcm91dGVfaGFuZGxlcnMvc3luY19yb3V0ZV9oYW5kbGVyJztcblxuaW1wb3J0IHtSb3V0ZVBhdGh9IGZyb20gJy4vcm91dGVfcGF0aHMvcm91dGVfcGF0aCc7XG5pbXBvcnQge1BhcmFtUm91dGVQYXRofSBmcm9tICcuL3JvdXRlX3BhdGhzL3BhcmFtX3JvdXRlX3BhdGgnO1xuaW1wb3J0IHtSZWdleFJvdXRlUGF0aH0gZnJvbSAnLi9yb3V0ZV9wYXRocy9yZWdleF9yb3V0ZV9wYXRoJztcblxuaW1wb3J0IHtVcmx9IGZyb20gJy4uL3VybF9wYXJzZXInO1xuaW1wb3J0IHtDb21wb25lbnRJbnN0cnVjdGlvbn0gZnJvbSAnLi4vaW5zdHJ1Y3Rpb24nO1xuXG5cbi8qKlxuICogQSBgUnVsZVNldGAgaXMgcmVzcG9uc2libGUgZm9yIHJlY29nbml6aW5nIHJvdXRlcyBmb3IgYSBwYXJ0aWN1bGFyIGNvbXBvbmVudC5cbiAqIEl0IGlzIGNvbnN1bWVkIGJ5IGBSb3V0ZVJlZ2lzdHJ5YCwgd2hpY2gga25vd3MgaG93IHRvIHJlY29nbml6ZSBhbiBlbnRpcmUgaGllcmFyY2h5IG9mXG4gKiBjb21wb25lbnRzLlxuICovXG5leHBvcnQgY2xhc3MgUnVsZVNldCB7XG4gIHJ1bGVzQnlOYW1lID0gbmV3IE1hcDxzdHJpbmcsIFJvdXRlUnVsZT4oKTtcblxuICAvLyBtYXAgZnJvbSBuYW1lIHRvIHJ1bGVcbiAgYXV4UnVsZXNCeU5hbWUgPSBuZXcgTWFwPHN0cmluZywgUm91dGVSdWxlPigpO1xuXG4gIC8vIG1hcCBmcm9tIHN0YXJ0aW5nIHBhdGggdG8gcnVsZVxuICBhdXhSdWxlc0J5UGF0aCA9IG5ldyBNYXA8c3RyaW5nLCBSb3V0ZVJ1bGU+KCk7XG5cbiAgLy8gVE9ETzogb3B0aW1pemUgdGhpcyBpbnRvIGEgdHJpZVxuICBydWxlczogQWJzdHJhY3RSdWxlW10gPSBbXTtcblxuICAvLyB0aGUgcnVsZSB0byB1c2UgYXV0b21hdGljYWxseSB3aGVuIHJlY29nbml6aW5nIG9yIGdlbmVyYXRpbmcgZnJvbSB0aGlzIHJ1bGUgc2V0XG4gIGRlZmF1bHRSdWxlOiBSb3V0ZVJ1bGUgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBDb25maWd1cmUgYWRkaXRpb25hbCBydWxlcyBpbiB0aGlzIHJ1bGUgc2V0IGZyb20gYSByb3V0ZSBkZWZpbml0aW9uXG4gICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIHRoZSBjb25maWcgaXMgdGVybWluYWxcbiAgICovXG4gIGNvbmZpZyhjb25maWc6IFJvdXRlRGVmaW5pdGlvbik6IGJvb2xlYW4ge1xuICAgIGxldCBoYW5kbGVyO1xuXG4gICAgaWYgKGlzUHJlc2VudChjb25maWcubmFtZSkgJiYgY29uZmlnLm5hbWVbMF0udG9VcHBlckNhc2UoKSAhPSBjb25maWcubmFtZVswXSkge1xuICAgICAgbGV0IHN1Z2dlc3RlZE5hbWUgPSBjb25maWcubmFtZVswXS50b1VwcGVyQ2FzZSgpICsgY29uZmlnLm5hbWUuc3Vic3RyaW5nKDEpO1xuICAgICAgdGhyb3cgbmV3IEJhc2VFeGNlcHRpb24oXG4gICAgICAgICAgYFJvdXRlIFwiJHtjb25maWcucGF0aH1cIiB3aXRoIG5hbWUgXCIke2NvbmZpZy5uYW1lfVwiIGRvZXMgbm90IGJlZ2luIHdpdGggYW4gdXBwZXJjYXNlIGxldHRlci4gUm91dGUgbmFtZXMgc2hvdWxkIGJlIENhbWVsQ2FzZSBsaWtlIFwiJHtzdWdnZXN0ZWROYW1lfVwiLmApO1xuICAgIH1cblxuICAgIGlmIChjb25maWcgaW5zdGFuY2VvZiBBdXhSb3V0ZSkge1xuICAgICAgaGFuZGxlciA9IG5ldyBTeW5jUm91dGVIYW5kbGVyKGNvbmZpZy5jb21wb25lbnQsIGNvbmZpZy5kYXRhKTtcbiAgICAgIGxldCByb3V0ZVBhdGggPSB0aGlzLl9nZXRSb3V0ZVBhdGgoY29uZmlnKTtcbiAgICAgIGxldCBhdXhSdWxlID0gbmV3IFJvdXRlUnVsZShyb3V0ZVBhdGgsIGhhbmRsZXIsIGNvbmZpZy5uYW1lKTtcbiAgICAgIHRoaXMuYXV4UnVsZXNCeVBhdGguc2V0KHJvdXRlUGF0aC50b1N0cmluZygpLCBhdXhSdWxlKTtcbiAgICAgIGlmIChpc1ByZXNlbnQoY29uZmlnLm5hbWUpKSB7XG4gICAgICAgIHRoaXMuYXV4UnVsZXNCeU5hbWUuc2V0KGNvbmZpZy5uYW1lLCBhdXhSdWxlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhdXhSdWxlLnRlcm1pbmFsO1xuICAgIH1cblxuICAgIGxldCB1c2VBc0RlZmF1bHQgPSBmYWxzZTtcblxuICAgIGlmIChjb25maWcgaW5zdGFuY2VvZiBSZWRpcmVjdCkge1xuICAgICAgbGV0IHJvdXRlUGF0aCA9IHRoaXMuX2dldFJvdXRlUGF0aChjb25maWcpO1xuICAgICAgbGV0IHJlZGlyZWN0b3IgPSBuZXcgUmVkaXJlY3RSdWxlKHJvdXRlUGF0aCwgY29uZmlnLnJlZGlyZWN0VG8pO1xuICAgICAgdGhpcy5fYXNzZXJ0Tm9IYXNoQ29sbGlzaW9uKHJlZGlyZWN0b3IuaGFzaCwgY29uZmlnLnBhdGgpO1xuICAgICAgdGhpcy5ydWxlcy5wdXNoKHJlZGlyZWN0b3IpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZyBpbnN0YW5jZW9mIFJvdXRlKSB7XG4gICAgICBoYW5kbGVyID0gbmV3IFN5bmNSb3V0ZUhhbmRsZXIoY29uZmlnLmNvbXBvbmVudCwgY29uZmlnLmRhdGEpO1xuICAgICAgdXNlQXNEZWZhdWx0ID0gaXNQcmVzZW50KGNvbmZpZy51c2VBc0RlZmF1bHQpICYmIGNvbmZpZy51c2VBc0RlZmF1bHQ7XG4gICAgfSBlbHNlIGlmIChjb25maWcgaW5zdGFuY2VvZiBBc3luY1JvdXRlKSB7XG4gICAgICBoYW5kbGVyID0gbmV3IEFzeW5jUm91dGVIYW5kbGVyKGNvbmZpZy5sb2FkZXIsIGNvbmZpZy5kYXRhKTtcbiAgICAgIHVzZUFzRGVmYXVsdCA9IGlzUHJlc2VudChjb25maWcudXNlQXNEZWZhdWx0KSAmJiBjb25maWcudXNlQXNEZWZhdWx0O1xuICAgIH1cbiAgICBsZXQgcm91dGVQYXRoID0gdGhpcy5fZ2V0Um91dGVQYXRoKGNvbmZpZyk7XG4gICAgbGV0IG5ld1J1bGUgPSBuZXcgUm91dGVSdWxlKHJvdXRlUGF0aCwgaGFuZGxlciwgY29uZmlnLm5hbWUpO1xuXG4gICAgdGhpcy5fYXNzZXJ0Tm9IYXNoQ29sbGlzaW9uKG5ld1J1bGUuaGFzaCwgY29uZmlnLnBhdGgpO1xuXG4gICAgaWYgKHVzZUFzRGVmYXVsdCkge1xuICAgICAgaWYgKGlzUHJlc2VudCh0aGlzLmRlZmF1bHRSdWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgQmFzZUV4Y2VwdGlvbihgT25seSBvbmUgcm91dGUgY2FuIGJlIGRlZmF1bHRgKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVmYXVsdFJ1bGUgPSBuZXdSdWxlO1xuICAgIH1cblxuICAgIHRoaXMucnVsZXMucHVzaChuZXdSdWxlKTtcbiAgICBpZiAoaXNQcmVzZW50KGNvbmZpZy5uYW1lKSkge1xuICAgICAgdGhpcy5ydWxlc0J5TmFtZS5zZXQoY29uZmlnLm5hbWUsIG5ld1J1bGUpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UnVsZS50ZXJtaW5hbDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgVVJMLCByZXR1cm5zIGEgbGlzdCBvZiBgUm91dGVNYXRjaGBlcywgd2hpY2ggYXJlIHBhcnRpYWwgcmVjb2duaXRpb25zIGZvciBzb21lIHJvdXRlLlxuICAgKi9cbiAgcmVjb2duaXplKHVybFBhcnNlOiBVcmwpOiBQcm9taXNlPFJvdXRlTWF0Y2g+W10ge1xuICAgIHZhciBzb2x1dGlvbnMgPSBbXTtcblxuICAgIHRoaXMucnVsZXMuZm9yRWFjaCgocm91dGVSZWNvZ25pemVyOiBBYnN0cmFjdFJ1bGUpID0+IHtcbiAgICAgIHZhciBwYXRoTWF0Y2ggPSByb3V0ZVJlY29nbml6ZXIucmVjb2duaXplKHVybFBhcnNlKTtcblxuICAgICAgaWYgKGlzUHJlc2VudChwYXRoTWF0Y2gpKSB7XG4gICAgICAgIHNvbHV0aW9ucy5wdXNoKHBhdGhNYXRjaCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgY2FzZXMgd2hlcmUgd2UgYXJlIHJvdXRpbmcganVzdCB0byBhbiBhdXggcm91dGVcbiAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAwICYmIGlzUHJlc2VudCh1cmxQYXJzZSkgJiYgdXJsUGFyc2UuYXV4aWxpYXJ5Lmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBbUHJvbWlzZVdyYXBwZXIucmVzb2x2ZShuZXcgUGF0aE1hdGNoKG51bGwsIG51bGwsIHVybFBhcnNlLmF1eGlsaWFyeSkpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gc29sdXRpb25zO1xuICB9XG5cbiAgcmVjb2duaXplQXV4aWxpYXJ5KHVybFBhcnNlOiBVcmwpOiBQcm9taXNlPFJvdXRlTWF0Y2g+W10ge1xuICAgIHZhciByb3V0ZVJlY29nbml6ZXI6IFJvdXRlUnVsZSA9IHRoaXMuYXV4UnVsZXNCeVBhdGguZ2V0KHVybFBhcnNlLnBhdGgpO1xuICAgIGlmIChpc1ByZXNlbnQocm91dGVSZWNvZ25pemVyKSkge1xuICAgICAgcmV0dXJuIFtyb3V0ZVJlY29nbml6ZXIucmVjb2duaXplKHVybFBhcnNlKV07XG4gICAgfVxuXG4gICAgcmV0dXJuIFtQcm9taXNlV3JhcHBlci5yZXNvbHZlKG51bGwpXTtcbiAgfVxuXG4gIGhhc1JvdXRlKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5ydWxlc0J5TmFtZS5oYXMobmFtZSk7IH1cblxuICBjb21wb25lbnRMb2FkZWQobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuaGFzUm91dGUobmFtZSkgJiYgaXNQcmVzZW50KHRoaXMucnVsZXNCeU5hbWUuZ2V0KG5hbWUpLmhhbmRsZXIuY29tcG9uZW50VHlwZSk7XG4gIH1cblxuICBsb2FkQ29tcG9uZW50KG5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMucnVsZXNCeU5hbWUuZ2V0KG5hbWUpLmhhbmRsZXIucmVzb2x2ZUNvbXBvbmVudFR5cGUoKTtcbiAgfVxuXG4gIGdlbmVyYXRlKG5hbWU6IHN0cmluZywgcGFyYW1zOiBhbnkpOiBDb21wb25lbnRJbnN0cnVjdGlvbiB7XG4gICAgdmFyIHJ1bGU6IFJvdXRlUnVsZSA9IHRoaXMucnVsZXNCeU5hbWUuZ2V0KG5hbWUpO1xuICAgIGlmIChpc0JsYW5rKHJ1bGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHJ1bGUuZ2VuZXJhdGUocGFyYW1zKTtcbiAgfVxuXG4gIGdlbmVyYXRlQXV4aWxpYXJ5KG5hbWU6IHN0cmluZywgcGFyYW1zOiBhbnkpOiBDb21wb25lbnRJbnN0cnVjdGlvbiB7XG4gICAgdmFyIHJ1bGU6IFJvdXRlUnVsZSA9IHRoaXMuYXV4UnVsZXNCeU5hbWUuZ2V0KG5hbWUpO1xuICAgIGlmIChpc0JsYW5rKHJ1bGUpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHJ1bGUuZ2VuZXJhdGUocGFyYW1zKTtcbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydE5vSGFzaENvbGxpc2lvbihoYXNoOiBzdHJpbmcsIHBhdGgpIHtcbiAgICB0aGlzLnJ1bGVzLmZvckVhY2goKHJ1bGUpID0+IHtcbiAgICAgIGlmIChoYXNoID09IHJ1bGUuaGFzaCkge1xuICAgICAgICB0aHJvdyBuZXcgQmFzZUV4Y2VwdGlvbihcbiAgICAgICAgICAgIGBDb25maWd1cmF0aW9uICcke3BhdGh9JyBjb25mbGljdHMgd2l0aCBleGlzdGluZyByb3V0ZSAnJHtydWxlLnBhdGh9J2ApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0Um91dGVQYXRoKGNvbmZpZzogUm91dGVEZWZpbml0aW9uKTogUm91dGVQYXRoIHtcbiAgICBpZiAoaXNQcmVzZW50KGNvbmZpZy5yZWdleCkpIHtcbiAgICAgIGlmIChpc0Z1bmN0aW9uKGNvbmZpZy5zZXJpYWxpemVyKSkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ2V4Um91dGVQYXRoKGNvbmZpZy5yZWdleCwgY29uZmlnLnNlcmlhbGl6ZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEJhc2VFeGNlcHRpb24oXG4gICAgICAgICAgICBgUm91dGUgcHJvdmlkZXMgYSByZWdleCBwcm9wZXJ0eSwgJyR7Y29uZmlnLnJlZ2V4fScsIGJ1dCBubyBzZXJpYWxpemVyIHByb3BlcnR5YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpc1ByZXNlbnQoY29uZmlnLnBhdGgpKSB7XG4gICAgICAvLyBBdXhpbGlhcnkgcm91dGVzIGRvIG5vdCBoYXZlIGEgc2xhc2ggYXQgdGhlIHN0YXJ0XG4gICAgICBsZXQgcGF0aCA9IChjb25maWcgaW5zdGFuY2VvZiBBdXhSb3V0ZSAmJiBjb25maWcucGF0aC5zdGFydHNXaXRoKCcvJykpID9cbiAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5wYXRoLnN1YnN0cmluZygxKSA6XG4gICAgICAgICAgICAgICAgICAgICBjb25maWcucGF0aDtcbiAgICAgIHJldHVybiBuZXcgUGFyYW1Sb3V0ZVBhdGgocGF0aCk7XG4gICAgfVxuICAgIHRocm93IG5ldyBCYXNlRXhjZXB0aW9uKCdSb3V0ZSBtdXN0IHByb3ZpZGUgZWl0aGVyIGEgcGF0aCBvciByZWdleCBwcm9wZXJ0eScpO1xuICB9XG59XG4iXX0=