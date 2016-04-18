import { RegExpWrapper, StringWrapper, isPresent, isBlank } from 'angular2/src/facade/lang';
import { BaseException } from 'angular2/src/facade/exceptions';
import { StringMapWrapper } from 'angular2/src/facade/collection';
import { TouchMap, normalizeString } from '../../utils';
import { RootUrl, convertUrlParamsToArray } from '../../url_parser';
import { GeneratedUrl, MatchedUrl } from './route_path';
/**
 * Identified by a `...` URL segment. This indicates that the
 * Route will continue to be matched by child `Router`s.
 */
class ContinuationPathSegment {
    constructor() {
        this.name = '';
        this.specificity = '';
        this.hash = '...';
    }
    generate(params) { return ''; }
    match(path) { return true; }
}
/**
 * Identified by a string not starting with a `:` or `*`.
 * Only matches the URL segments that equal the segment path
 */
class StaticPathSegment {
    constructor(path) {
        this.path = path;
        this.name = '';
        this.specificity = '2';
        this.hash = path;
    }
    match(path) { return path == this.path; }
    generate(params) { return this.path; }
}
/**
 * Identified by a string starting with `:`. Indicates a segment
 * that can contain a value that will be extracted and provided to
 * a matching `Instruction`.
 */
class DynamicPathSegment {
    constructor(name) {
        this.name = name;
        this.specificity = '1';
        this.hash = ':';
    }
    match(path) { return path.length > 0; }
    generate(params) {
        if (!StringMapWrapper.contains(params.map, this.name)) {
            throw new BaseException(`Route generator for '${this.name}' was not included in parameters passed.`);
        }
        return encodeDynamicSegment(normalizeString(params.get(this.name)));
    }
}
DynamicPathSegment.paramMatcher = /^:([^\/]+)$/g;
/**
 * Identified by a string starting with `*` Indicates that all the following
 * segments match this route and that the value of these segments should
 * be provided to a matching `Instruction`.
 */
class StarPathSegment {
    constructor(name) {
        this.name = name;
        this.specificity = '0';
        this.hash = '*';
    }
    match(path) { return true; }
    generate(params) { return normalizeString(params.get(this.name)); }
}
StarPathSegment.wildcardMatcher = /^\*([^\/]+)$/g;
/**
 * Parses a URL string using a given matcher DSL, and generates URLs from param maps
 */
export class ParamRoutePath {
    /**
     * Takes a string representing the matcher DSL
     */
    constructor(routePath) {
        this.routePath = routePath;
        this.terminal = true;
        this._assertValidPath(routePath);
        this._parsePathString(routePath);
        this.specificity = this._calculateSpecificity();
        this.hash = this._calculateHash();
        var lastSegment = this._segments[this._segments.length - 1];
        this.terminal = !(lastSegment instanceof ContinuationPathSegment);
    }
    matchUrl(url) {
        var nextUrlSegment = url;
        var currentUrlSegment;
        var positionalParams = {};
        var captured = [];
        for (var i = 0; i < this._segments.length; i += 1) {
            var pathSegment = this._segments[i];
            currentUrlSegment = nextUrlSegment;
            if (pathSegment instanceof ContinuationPathSegment) {
                break;
            }
            if (isPresent(currentUrlSegment)) {
                // the star segment consumes all of the remaining URL, including matrix params
                if (pathSegment instanceof StarPathSegment) {
                    positionalParams[pathSegment.name] = currentUrlSegment.toString();
                    captured.push(currentUrlSegment.toString());
                    nextUrlSegment = null;
                    break;
                }
                captured.push(currentUrlSegment.path);
                if (pathSegment instanceof DynamicPathSegment) {
                    positionalParams[pathSegment.name] = decodeDynamicSegment(currentUrlSegment.path);
                }
                else if (!pathSegment.match(currentUrlSegment.path)) {
                    return null;
                }
                nextUrlSegment = currentUrlSegment.child;
            }
            else if (!pathSegment.match('')) {
                return null;
            }
        }
        if (this.terminal && isPresent(nextUrlSegment)) {
            return null;
        }
        var urlPath = captured.join('/');
        var auxiliary = [];
        var urlParams = [];
        var allParams = positionalParams;
        if (isPresent(currentUrlSegment)) {
            // If this is the root component, read query params. Otherwise, read matrix params.
            var paramsSegment = url instanceof RootUrl ? url : currentUrlSegment;
            if (isPresent(paramsSegment.params)) {
                allParams = StringMapWrapper.merge(paramsSegment.params, positionalParams);
                urlParams = convertUrlParamsToArray(paramsSegment.params);
            }
            else {
                allParams = positionalParams;
            }
            auxiliary = currentUrlSegment.auxiliary;
        }
        return new MatchedUrl(urlPath, urlParams, allParams, auxiliary, nextUrlSegment);
    }
    generateUrl(params) {
        var paramTokens = new TouchMap(params);
        var path = [];
        for (var i = 0; i < this._segments.length; i++) {
            let segment = this._segments[i];
            if (!(segment instanceof ContinuationPathSegment)) {
                path.push(segment.generate(paramTokens));
            }
        }
        var urlPath = path.join('/');
        var nonPositionalParams = paramTokens.getUnused();
        var urlParams = nonPositionalParams;
        return new GeneratedUrl(urlPath, urlParams);
    }
    toString() { return this.routePath; }
    _parsePathString(routePath) {
        // normalize route as not starting with a "/". Recognition will
        // also normalize.
        if (routePath.startsWith("/")) {
            routePath = routePath.substring(1);
        }
        var segmentStrings = routePath.split('/');
        this._segments = [];
        var limit = segmentStrings.length - 1;
        for (var i = 0; i <= limit; i++) {
            var segment = segmentStrings[i], match;
            if (isPresent(match = RegExpWrapper.firstMatch(DynamicPathSegment.paramMatcher, segment))) {
                this._segments.push(new DynamicPathSegment(match[1]));
            }
            else if (isPresent(match = RegExpWrapper.firstMatch(StarPathSegment.wildcardMatcher, segment))) {
                this._segments.push(new StarPathSegment(match[1]));
            }
            else if (segment == '...') {
                if (i < limit) {
                    throw new BaseException(`Unexpected "..." before the end of the path for "${routePath}".`);
                }
                this._segments.push(new ContinuationPathSegment());
            }
            else {
                this._segments.push(new StaticPathSegment(segment));
            }
        }
    }
    _calculateSpecificity() {
        // The "specificity" of a path is used to determine which route is used when multiple routes
        // match
        // a URL. Static segments (like "/foo") are the most specific, followed by dynamic segments
        // (like
        // "/:id"). Star segments add no specificity. Segments at the start of the path are more
        // specific
        // than proceeding ones.
        //
        // The code below uses place values to combine the different types of segments into a single
        // string that we can sort later. Each static segment is marked as a specificity of "2," each
        // dynamic segment is worth "1" specificity, and stars are worth "0" specificity.
        var i, length = this._segments.length, specificity;
        if (length == 0) {
            // a single slash (or "empty segment" is as specific as a static segment
            specificity += '2';
        }
        else {
            specificity = '';
            for (i = 0; i < length; i++) {
                specificity += this._segments[i].specificity;
            }
        }
        return specificity;
    }
    _calculateHash() {
        // this function is used to determine whether a route config path like `/foo/:id` collides with
        // `/foo/:name`
        var i, length = this._segments.length;
        var hashParts = [];
        for (i = 0; i < length; i++) {
            hashParts.push(this._segments[i].hash);
        }
        return hashParts.join('/');
    }
    _assertValidPath(path) {
        if (StringWrapper.contains(path, '#')) {
            throw new BaseException(`Path "${path}" should not include "#". Use "HashLocationStrategy" instead.`);
        }
        var illegalCharacter = RegExpWrapper.firstMatch(ParamRoutePath.RESERVED_CHARS, path);
        if (isPresent(illegalCharacter)) {
            throw new BaseException(`Path "${path}" contains "${illegalCharacter[0]}" which is not allowed in a route config.`);
        }
    }
}
ParamRoutePath.RESERVED_CHARS = RegExpWrapper.create('//|\\(|\\)|;|\\?|=');
let REGEXP_PERCENT = /%/g;
let REGEXP_SLASH = /\//g;
let REGEXP_OPEN_PARENT = /\(/g;
let REGEXP_CLOSE_PARENT = /\)/g;
let REGEXP_SEMICOLON = /;/g;
function encodeDynamicSegment(value) {
    if (isBlank(value)) {
        return null;
    }
    value = StringWrapper.replaceAll(value, REGEXP_PERCENT, '%25');
    value = StringWrapper.replaceAll(value, REGEXP_SLASH, '%2F');
    value = StringWrapper.replaceAll(value, REGEXP_OPEN_PARENT, '%28');
    value = StringWrapper.replaceAll(value, REGEXP_CLOSE_PARENT, '%29');
    value = StringWrapper.replaceAll(value, REGEXP_SEMICOLON, '%3B');
    return value;
}
let REGEXP_ENC_SEMICOLON = /%3B/ig;
let REGEXP_ENC_CLOSE_PARENT = /%29/ig;
let REGEXP_ENC_OPEN_PARENT = /%28/ig;
let REGEXP_ENC_SLASH = /%2F/ig;
let REGEXP_ENC_PERCENT = /%25/ig;
function decodeDynamicSegment(value) {
    if (isBlank(value)) {
        return null;
    }
    value = StringWrapper.replaceAll(value, REGEXP_ENC_SEMICOLON, ';');
    value = StringWrapper.replaceAll(value, REGEXP_ENC_CLOSE_PARENT, ')');
    value = StringWrapper.replaceAll(value, REGEXP_ENC_OPEN_PARENT, '(');
    value = StringWrapper.replaceAll(value, REGEXP_ENC_SLASH, '/');
    value = StringWrapper.replaceAll(value, REGEXP_ENC_PERCENT, '%');
    return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYW1fcm91dGVfcGF0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtMTNmcWt2NGkudG1wL2FuZ3VsYXIyL3NyYy9yb3V0ZXIvcnVsZXMvcm91dGVfcGF0aHMvcGFyYW1fcm91dGVfcGF0aC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiT0FBTyxFQUFDLGFBQWEsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBQyxNQUFNLDBCQUEwQjtPQUNsRixFQUFDLGFBQWEsRUFBQyxNQUFNLGdDQUFnQztPQUNyRCxFQUFDLGdCQUFnQixFQUFDLE1BQU0sZ0NBQWdDO09BRXhELEVBQUMsUUFBUSxFQUFFLGVBQWUsRUFBQyxNQUFNLGFBQWE7T0FDOUMsRUFBTSxPQUFPLEVBQUUsdUJBQXVCLEVBQUMsTUFBTSxrQkFBa0I7T0FDL0QsRUFBWSxZQUFZLEVBQUUsVUFBVSxFQUFDLE1BQU0sY0FBYztBQWlCaEU7OztHQUdHO0FBQ0g7SUFBQTtRQUNFLFNBQUksR0FBVyxFQUFFLENBQUM7UUFDbEIsZ0JBQVcsR0FBRyxFQUFFLENBQUM7UUFDakIsU0FBSSxHQUFHLEtBQUssQ0FBQztJQUdmLENBQUM7SUFGQyxRQUFRLENBQUMsTUFBZ0IsSUFBWSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNqRCxLQUFLLENBQUMsSUFBWSxJQUFhLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7O0dBR0c7QUFDSDtJQUlFLFlBQW1CLElBQVk7UUFBWixTQUFJLEdBQUosSUFBSSxDQUFRO1FBSC9CLFNBQUksR0FBVyxFQUFFLENBQUM7UUFDbEIsZ0JBQVcsR0FBRyxHQUFHLENBQUM7UUFFaUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFBQyxDQUFDO0lBQ3RELEtBQUssQ0FBQyxJQUFZLElBQWEsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJ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QUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UmVnRXhwV3JhcHBlciwgU3RyaW5nV3JhcHBlciwgaXNQcmVzZW50LCBpc0JsYW5rfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuaW1wb3J0IHtCYXNlRXhjZXB0aW9ufSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2V4Y2VwdGlvbnMnO1xuaW1wb3J0IHtTdHJpbmdNYXBXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2NvbGxlY3Rpb24nO1xuXG5pbXBvcnQge1RvdWNoTWFwLCBub3JtYWxpemVTdHJpbmd9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7VXJsLCBSb290VXJsLCBjb252ZXJ0VXJsUGFyYW1zVG9BcnJheX0gZnJvbSAnLi4vLi4vdXJsX3BhcnNlcic7XG5pbXBvcnQge1JvdXRlUGF0aCwgR2VuZXJhdGVkVXJsLCBNYXRjaGVkVXJsfSBmcm9tICcuL3JvdXRlX3BhdGgnO1xuXG5cblxuLyoqXG4gKiBgUGFyYW1Sb3V0ZVBhdGhgcyBhcmUgbWFkZSB1cCBvZiBgUGF0aFNlZ21lbnRgcywgZWFjaCBvZiB3aGljaCBjYW5cbiAqIG1hdGNoIGEgc2VnbWVudCBvZiBhIFVSTC4gRGlmZmVyZW50IGtpbmQgb2YgYFBhdGhTZWdtZW50YHMgbWF0Y2hcbiAqIFVSTCBzZWdtZW50cyBpbiBkaWZmZXJlbnQgd2F5cy4uLlxuICovXG5pbnRlcmZhY2UgUGF0aFNlZ21lbnQge1xuICBuYW1lOiBzdHJpbmc7XG4gIGdlbmVyYXRlKHBhcmFtczogVG91Y2hNYXApOiBzdHJpbmc7XG4gIG1hdGNoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW47XG4gIHNwZWNpZmljaXR5OiBzdHJpbmc7XG4gIGhhc2g6IHN0cmluZztcbn1cblxuLyoqXG4gKiBJZGVudGlmaWVkIGJ5IGEgYC4uLmAgVVJMIHNlZ21lbnQuIFRoaXMgaW5kaWNhdGVzIHRoYXQgdGhlXG4gKiBSb3V0ZSB3aWxsIGNvbnRpbnVlIHRvIGJlIG1hdGNoZWQgYnkgY2hpbGQgYFJvdXRlcmBzLlxuICovXG5jbGFzcyBDb250aW51YXRpb25QYXRoU2VnbWVudCBpbXBsZW1lbnRzIFBhdGhTZWdtZW50IHtcbiAgbmFtZTogc3RyaW5nID0gJyc7XG4gIHNwZWNpZmljaXR5ID0gJyc7XG4gIGhhc2ggPSAnLi4uJztcbiAgZ2VuZXJhdGUocGFyYW1zOiBUb3VjaE1hcCk6IHN0cmluZyB7IHJldHVybiAnJzsgfVxuICBtYXRjaChwYXRoOiBzdHJpbmcpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cbn1cblxuLyoqXG4gKiBJZGVudGlmaWVkIGJ5IGEgc3RyaW5nIG5vdCBzdGFydGluZyB3aXRoIGEgYDpgIG9yIGAqYC5cbiAqIE9ubHkgbWF0Y2hlcyB0aGUgVVJMIHNlZ21lbnRzIHRoYXQgZXF1YWwgdGhlIHNlZ21lbnQgcGF0aFxuICovXG5jbGFzcyBTdGF0aWNQYXRoU2VnbWVudCBpbXBsZW1lbnRzIFBhdGhTZWdtZW50IHtcbiAgbmFtZTogc3RyaW5nID0gJyc7XG4gIHNwZWNpZmljaXR5ID0gJzInO1xuICBoYXNoOiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwYXRoOiBzdHJpbmcpIHsgdGhpcy5oYXNoID0gcGF0aDsgfVxuICBtYXRjaChwYXRoOiBzdHJpbmcpOiBib29sZWFuIHsgcmV0dXJuIHBhdGggPT0gdGhpcy5wYXRoOyB9XG4gIGdlbmVyYXRlKHBhcmFtczogVG91Y2hNYXApOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5wYXRoOyB9XG59XG5cbi8qKlxuICogSWRlbnRpZmllZCBieSBhIHN0cmluZyBzdGFydGluZyB3aXRoIGA6YC4gSW5kaWNhdGVzIGEgc2VnbWVudFxuICogdGhhdCBjYW4gY29udGFpbiBhIHZhbHVlIHRoYXQgd2lsbCBiZSBleHRyYWN0ZWQgYW5kIHByb3ZpZGVkIHRvXG4gKiBhIG1hdGNoaW5nIGBJbnN0cnVjdGlvbmAuXG4gKi9cbmNsYXNzIER5bmFtaWNQYXRoU2VnbWVudCBpbXBsZW1lbnRzIFBhdGhTZWdtZW50IHtcbiAgc3RhdGljIHBhcmFtTWF0Y2hlciA9IC9eOihbXlxcL10rKSQvZztcbiAgc3BlY2lmaWNpdHkgPSAnMSc7XG4gIGhhc2ggPSAnOic7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcpIHt9XG4gIG1hdGNoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4geyByZXR1cm4gcGF0aC5sZW5ndGggPiAwOyB9XG4gIGdlbmVyYXRlKHBhcmFtczogVG91Y2hNYXApOiBzdHJpbmcge1xuICAgIGlmICghU3RyaW5nTWFwV3JhcHBlci5jb250YWlucyhwYXJhbXMubWFwLCB0aGlzLm5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgQmFzZUV4Y2VwdGlvbihcbiAgICAgICAgICBgUm91dGUgZ2VuZXJhdG9yIGZvciAnJHt0aGlzLm5hbWV9JyB3YXMgbm90IGluY2x1ZGVkIGluIHBhcmFtZXRlcnMgcGFzc2VkLmApO1xuICAgIH1cbiAgICByZXR1cm4gZW5jb2RlRHluYW1pY1NlZ21lbnQobm9ybWFsaXplU3RyaW5nKHBhcmFtcy5nZXQodGhpcy5uYW1lKSkpO1xuICB9XG59XG5cbi8qKlxuICogSWRlbnRpZmllZCBieSBhIHN0cmluZyBzdGFydGluZyB3aXRoIGAqYCBJbmRpY2F0ZXMgdGhhdCBhbGwgdGhlIGZvbGxvd2luZ1xuICogc2VnbWVudHMgbWF0Y2ggdGhpcyByb3V0ZSBhbmQgdGhhdCB0aGUgdmFsdWUgb2YgdGhlc2Ugc2VnbWVudHMgc2hvdWxkXG4gKiBiZSBwcm92aWRlZCB0byBhIG1hdGNoaW5nIGBJbnN0cnVjdGlvbmAuXG4gKi9cbmNsYXNzIFN0YXJQYXRoU2VnbWVudCBpbXBsZW1lbnRzIFBhdGhTZWdtZW50IHtcbiAgc3RhdGljIHdpbGRjYXJkTWF0Y2hlciA9IC9eXFwqKFteXFwvXSspJC9nO1xuICBzcGVjaWZpY2l0eSA9ICcwJztcbiAgaGFzaCA9ICcqJztcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZykge31cbiAgbWF0Y2gocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG4gIGdlbmVyYXRlKHBhcmFtczogVG91Y2hNYXApOiBzdHJpbmcgeyByZXR1cm4gbm9ybWFsaXplU3RyaW5nKHBhcmFtcy5nZXQodGhpcy5uYW1lKSk7IH1cbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBVUkwgc3RyaW5nIHVzaW5nIGEgZ2l2ZW4gbWF0Y2hlciBEU0wsIGFuZCBnZW5lcmF0ZXMgVVJMcyBmcm9tIHBhcmFtIG1hcHNcbiAqL1xuZXhwb3J0IGNsYXNzIFBhcmFtUm91dGVQYXRoIGltcGxlbWVudHMgUm91dGVQYXRoIHtcbiAgc3BlY2lmaWNpdHk6IHN0cmluZztcbiAgdGVybWluYWw6IGJvb2xlYW4gPSB0cnVlO1xuICBoYXNoOiBzdHJpbmc7XG5cbiAgcHJpdmF0ZSBfc2VnbWVudHM6IFBhdGhTZWdtZW50W107XG5cbiAgLyoqXG4gICAqIFRha2VzIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbWF0Y2hlciBEU0xcbiAgICovXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByb3V0ZVBhdGg6IHN0cmluZykge1xuICAgIHRoaXMuX2Fzc2VydFZhbGlkUGF0aChyb3V0ZVBhdGgpO1xuXG4gICAgdGhpcy5fcGFyc2VQYXRoU3RyaW5nKHJvdXRlUGF0aCk7XG4gICAgdGhpcy5zcGVjaWZpY2l0eSA9IHRoaXMuX2NhbGN1bGF0ZVNwZWNpZmljaXR5KCk7XG4gICAgdGhpcy5oYXNoID0gdGhpcy5fY2FsY3VsYXRlSGFzaCgpO1xuXG4gICAgdmFyIGxhc3RTZWdtZW50ID0gdGhpcy5fc2VnbWVudHNbdGhpcy5fc2VnbWVudHMubGVuZ3RoIC0gMV07XG4gICAgdGhpcy50ZXJtaW5hbCA9ICEobGFzdFNlZ21lbnQgaW5zdGFuY2VvZiBDb250aW51YXRpb25QYXRoU2VnbWVudCk7XG4gIH1cblxuICBtYXRjaFVybCh1cmw6IFVybCk6IE1hdGNoZWRVcmwge1xuICAgIHZhciBuZXh0VXJsU2VnbWVudCA9IHVybDtcbiAgICB2YXIgY3VycmVudFVybFNlZ21lbnQ6IFVybDtcbiAgICB2YXIgcG9zaXRpb25hbFBhcmFtcyA9IHt9O1xuICAgIHZhciBjYXB0dXJlZDogc3RyaW5nW10gPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fc2VnbWVudHMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIHZhciBwYXRoU2VnbWVudCA9IHRoaXMuX3NlZ21lbnRzW2ldO1xuXG4gICAgICBjdXJyZW50VXJsU2VnbWVudCA9IG5leHRVcmxTZWdtZW50O1xuICAgICAgaWYgKHBhdGhTZWdtZW50IGluc3RhbmNlb2YgQ29udGludWF0aW9uUGF0aFNlZ21lbnQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc1ByZXNlbnQoY3VycmVudFVybFNlZ21lbnQpKSB7XG4gICAgICAgIC8vIHRoZSBzdGFyIHNlZ21lbnQgY29uc3VtZXMgYWxsIG9mIHRoZSByZW1haW5pbmcgVVJMLCBpbmNsdWRpbmcgbWF0cml4IHBhcmFtc1xuICAgICAgICBpZiAocGF0aFNlZ21lbnQgaW5zdGFuY2VvZiBTdGFyUGF0aFNlZ21lbnQpIHtcbiAgICAgICAgICBwb3NpdGlvbmFsUGFyYW1zW3BhdGhTZWdtZW50Lm5hbWVdID0gY3VycmVudFVybFNlZ21lbnQudG9TdHJpbmcoKTtcbiAgICAgICAgICBjYXB0dXJlZC5wdXNoKGN1cnJlbnRVcmxTZWdtZW50LnRvU3RyaW5nKCkpO1xuICAgICAgICAgIG5leHRVcmxTZWdtZW50ID0gbnVsbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGNhcHR1cmVkLnB1c2goY3VycmVudFVybFNlZ21lbnQucGF0aCk7XG5cbiAgICAgICAgaWYgKHBhdGhTZWdtZW50IGluc3RhbmNlb2YgRHluYW1pY1BhdGhTZWdtZW50KSB7XG4gICAgICAgICAgcG9zaXRpb25hbFBhcmFtc1twYXRoU2VnbWVudC5uYW1lXSA9IGRlY29kZUR5bmFtaWNTZWdtZW50KGN1cnJlbnRVcmxTZWdtZW50LnBhdGgpO1xuICAgICAgICB9IGVsc2UgaWYgKCFwYXRoU2VnbWVudC5tYXRjaChjdXJyZW50VXJsU2VnbWVudC5wYXRoKSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbmV4dFVybFNlZ21lbnQgPSBjdXJyZW50VXJsU2VnbWVudC5jaGlsZDtcbiAgICAgIH0gZWxzZSBpZiAoIXBhdGhTZWdtZW50Lm1hdGNoKCcnKSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy50ZXJtaW5hbCAmJiBpc1ByZXNlbnQobmV4dFVybFNlZ21lbnQpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgdXJsUGF0aCA9IGNhcHR1cmVkLmpvaW4oJy8nKTtcblxuICAgIHZhciBhdXhpbGlhcnkgPSBbXTtcbiAgICB2YXIgdXJsUGFyYW1zID0gW107XG4gICAgdmFyIGFsbFBhcmFtcyA9IHBvc2l0aW9uYWxQYXJhbXM7XG4gICAgaWYgKGlzUHJlc2VudChjdXJyZW50VXJsU2VnbWVudCkpIHtcbiAgICAgIC8vIElmIHRoaXMgaXMgdGhlIHJvb3QgY29tcG9uZW50LCByZWFkIHF1ZXJ5IHBhcmFtcy4gT3RoZXJ3aXNlLCByZWFkIG1hdHJpeCBwYXJhbXMuXG4gICAgICB2YXIgcGFyYW1zU2VnbWVudCA9IHVybCBpbnN0YW5jZW9mIFJvb3RVcmwgPyB1cmwgOiBjdXJyZW50VXJsU2VnbWVudDtcblxuICAgICAgaWYgKGlzUHJlc2VudChwYXJhbXNTZWdtZW50LnBhcmFtcykpIHtcbiAgICAgICAgYWxsUGFyYW1zID0gU3RyaW5nTWFwV3JhcHBlci5tZXJnZShwYXJhbXNTZWdtZW50LnBhcmFtcywgcG9zaXRpb25hbFBhcmFtcyk7XG4gICAgICAgIHVybFBhcmFtcyA9IGNvbnZlcnRVcmxQYXJhbXNUb0FycmF5KHBhcmFtc1NlZ21lbnQucGFyYW1zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFsbFBhcmFtcyA9IHBvc2l0aW9uYWxQYXJhbXM7XG4gICAgICB9XG4gICAgICBhdXhpbGlhcnkgPSBjdXJyZW50VXJsU2VnbWVudC5hdXhpbGlhcnk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBNYXRjaGVkVXJsKHVybFBhdGgsIHVybFBhcmFtcywgYWxsUGFyYW1zLCBhdXhpbGlhcnksIG5leHRVcmxTZWdtZW50KTtcbiAgfVxuXG5cbiAgZ2VuZXJhdGVVcmwocGFyYW1zOiB7W2tleTogc3RyaW5nXTogYW55fSk6IEdlbmVyYXRlZFVybCB7XG4gICAgdmFyIHBhcmFtVG9rZW5zID0gbmV3IFRvdWNoTWFwKHBhcmFtcyk7XG5cbiAgICB2YXIgcGF0aCA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9zZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHNlZ21lbnQgPSB0aGlzLl9zZWdtZW50c1tpXTtcbiAgICAgIGlmICghKHNlZ21lbnQgaW5zdGFuY2VvZiBDb250aW51YXRpb25QYXRoU2VnbWVudCkpIHtcbiAgICAgICAgcGF0aC5wdXNoKHNlZ21lbnQuZ2VuZXJhdGUocGFyYW1Ub2tlbnMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHVybFBhdGggPSBwYXRoLmpvaW4oJy8nKTtcblxuICAgIHZhciBub25Qb3NpdGlvbmFsUGFyYW1zID0gcGFyYW1Ub2tlbnMuZ2V0VW51c2VkKCk7XG4gICAgdmFyIHVybFBhcmFtcyA9IG5vblBvc2l0aW9uYWxQYXJhbXM7XG5cbiAgICByZXR1cm4gbmV3IEdlbmVyYXRlZFVybCh1cmxQYXRoLCB1cmxQYXJhbXMpO1xuICB9XG5cblxuICB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5yb3V0ZVBhdGg7IH1cblxuICBwcml2YXRlIF9wYXJzZVBhdGhTdHJpbmcocm91dGVQYXRoOiBzdHJpbmcpIHtcbiAgICAvLyBub3JtYWxpemUgcm91dGUgYXMgbm90IHN0YXJ0aW5nIHdpdGggYSBcIi9cIi4gUmVjb2duaXRpb24gd2lsbFxuICAgIC8vIGFsc28gbm9ybWFsaXplLlxuICAgIGlmIChyb3V0ZVBhdGguc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgIHJvdXRlUGF0aCA9IHJvdXRlUGF0aC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuXG4gICAgdmFyIHNlZ21lbnRTdHJpbmdzID0gcm91dGVQYXRoLnNwbGl0KCcvJyk7XG4gICAgdGhpcy5fc2VnbWVudHMgPSBbXTtcblxuICAgIHZhciBsaW1pdCA9IHNlZ21lbnRTdHJpbmdzLmxlbmd0aCAtIDE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPD0gbGltaXQ7IGkrKykge1xuICAgICAgdmFyIHNlZ21lbnQgPSBzZWdtZW50U3RyaW5nc1tpXSwgbWF0Y2g7XG5cbiAgICAgIGlmIChpc1ByZXNlbnQobWF0Y2ggPSBSZWdFeHBXcmFwcGVyLmZpcnN0TWF0Y2goRHluYW1pY1BhdGhTZWdtZW50LnBhcmFtTWF0Y2hlciwgc2VnbWVudCkpKSB7XG4gICAgICAgIHRoaXMuX3NlZ21lbnRzLnB1c2gobmV3IER5bmFtaWNQYXRoU2VnbWVudChtYXRjaFsxXSkpO1xuICAgICAgfSBlbHNlIGlmIChpc1ByZXNlbnQoXG4gICAgICAgICAgICAgICAgICAgICBtYXRjaCA9IFJlZ0V4cFdyYXBwZXIuZmlyc3RNYXRjaChTdGFyUGF0aFNlZ21lbnQud2lsZGNhcmRNYXRjaGVyLCBzZWdtZW50KSkpIHtcbiAgICAgICAgdGhpcy5fc2VnbWVudHMucHVzaChuZXcgU3RhclBhdGhTZWdtZW50KG1hdGNoWzFdKSk7XG4gICAgICB9IGVsc2UgaWYgKHNlZ21lbnQgPT0gJy4uLicpIHtcbiAgICAgICAgaWYgKGkgPCBsaW1pdCkge1xuICAgICAgICAgIHRocm93IG5ldyBCYXNlRXhjZXB0aW9uKFxuICAgICAgICAgICAgICBgVW5leHBlY3RlZCBcIi4uLlwiIGJlZm9yZSB0aGUgZW5kIG9mIHRoZSBwYXRoIGZvciBcIiR7cm91dGVQYXRofVwiLmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NlZ21lbnRzLnB1c2gobmV3IENvbnRpbnVhdGlvblBhdGhTZWdtZW50KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fc2VnbWVudHMucHVzaChuZXcgU3RhdGljUGF0aFNlZ21lbnQoc2VnbWVudCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NhbGN1bGF0ZVNwZWNpZmljaXR5KCk6IHN0cmluZyB7XG4gICAgLy8gVGhlIFwic3BlY2lmaWNpdHlcIiBvZiBhIHBhdGggaXMgdXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggcm91dGUgaXMgdXNlZCB3aGVuIG11bHRpcGxlIHJvdXRlc1xuICAgIC8vIG1hdGNoXG4gICAgLy8gYSBVUkwuIFN0YXRpYyBzZWdtZW50cyAobGlrZSBcIi9mb29cIikgYXJlIHRoZSBtb3N0IHNwZWNpZmljLCBmb2xsb3dlZCBieSBkeW5hbWljIHNlZ21lbnRzXG4gICAgLy8gKGxpa2VcbiAgICAvLyBcIi86aWRcIikuIFN0YXIgc2VnbWVudHMgYWRkIG5vIHNwZWNpZmljaXR5LiBTZWdtZW50cyBhdCB0aGUgc3RhcnQgb2YgdGhlIHBhdGggYXJlIG1vcmVcbiAgICAvLyBzcGVjaWZpY1xuICAgIC8vIHRoYW4gcHJvY2VlZGluZyBvbmVzLlxuICAgIC8vXG4gICAgLy8gVGhlIGNvZGUgYmVsb3cgdXNlcyBwbGFjZSB2YWx1ZXMgdG8gY29tYmluZSB0aGUgZGlmZmVyZW50IHR5cGVzIG9mIHNlZ21lbnRzIGludG8gYSBzaW5nbGVcbiAgICAvLyBzdHJpbmcgdGhhdCB3ZSBjYW4gc29ydCBsYXRlci4gRWFjaCBzdGF0aWMgc2VnbWVudCBpcyBtYXJrZWQgYXMgYSBzcGVjaWZpY2l0eSBvZiBcIjIsXCIgZWFjaFxuICAgIC8vIGR5bmFtaWMgc2VnbWVudCBpcyB3b3J0aCBcIjFcIiBzcGVjaWZpY2l0eSwgYW5kIHN0YXJzIGFyZSB3b3J0aCBcIjBcIiBzcGVjaWZpY2l0eS5cbiAgICB2YXIgaSwgbGVuZ3RoID0gdGhpcy5fc2VnbWVudHMubGVuZ3RoLCBzcGVjaWZpY2l0eTtcbiAgICBpZiAobGVuZ3RoID09IDApIHtcbiAgICAgIC8vIGEgc2luZ2xlIHNsYXNoIChvciBcImVtcHR5IHNlZ21lbnRcIiBpcyBhcyBzcGVjaWZpYyBhcyBhIHN0YXRpYyBzZWdtZW50XG4gICAgICBzcGVjaWZpY2l0eSArPSAnMic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNwZWNpZmljaXR5ID0gJyc7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3BlY2lmaWNpdHkgKz0gdGhpcy5fc2VnbWVudHNbaV0uc3BlY2lmaWNpdHk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzcGVjaWZpY2l0eTtcbiAgfVxuXG4gIHByaXZhdGUgX2NhbGN1bGF0ZUhhc2goKTogc3RyaW5nIHtcbiAgICAvLyB0aGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYSByb3V0ZSBjb25maWcgcGF0aCBsaWtlIGAvZm9vLzppZGAgY29sbGlkZXMgd2l0aFxuICAgIC8vIGAvZm9vLzpuYW1lYFxuICAgIHZhciBpLCBsZW5ndGggPSB0aGlzLl9zZWdtZW50cy5sZW5ndGg7XG4gICAgdmFyIGhhc2hQYXJ0cyA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaGFzaFBhcnRzLnB1c2godGhpcy5fc2VnbWVudHNbaV0uaGFzaCk7XG4gICAgfVxuICAgIHJldHVybiBoYXNoUGFydHMuam9pbignLycpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0VmFsaWRQYXRoKHBhdGg6IHN0cmluZykge1xuICAgIGlmIChTdHJpbmdXcmFwcGVyLmNvbnRhaW5zKHBhdGgsICcjJykpIHtcbiAgICAgIHRocm93IG5ldyBCYXNlRXhjZXB0aW9uKFxuICAgICAgICAgIGBQYXRoIFwiJHtwYXRofVwiIHNob3VsZCBub3QgaW5jbHVkZSBcIiNcIi4gVXNlIFwiSGFzaExvY2F0aW9uU3RyYXRlZ3lcIiBpbnN0ZWFkLmApO1xuICAgIH1cbiAgICB2YXIgaWxsZWdhbENoYXJhY3RlciA9IFJlZ0V4cFdyYXBwZXIuZmlyc3RNYXRjaChQYXJhbVJvdXRlUGF0aC5SRVNFUlZFRF9DSEFSUywgcGF0aCk7XG4gICAgaWYgKGlzUHJlc2VudChpbGxlZ2FsQ2hhcmFjdGVyKSkge1xuICAgICAgdGhyb3cgbmV3IEJhc2VFeGNlcHRpb24oXG4gICAgICAgICAgYFBhdGggXCIke3BhdGh9XCIgY29udGFpbnMgXCIke2lsbGVnYWxDaGFyYWN0ZXJbMF19XCIgd2hpY2ggaXMgbm90IGFsbG93ZWQgaW4gYSByb3V0ZSBjb25maWcuYCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBSRVNFUlZFRF9DSEFSUyA9IFJlZ0V4cFdyYXBwZXIuY3JlYXRlKCcvL3xcXFxcKHxcXFxcKXw7fFxcXFw/fD0nKTtcbn1cblxubGV0IFJFR0VYUF9QRVJDRU5UID0gLyUvZztcbmxldCBSRUdFWFBfU0xBU0ggPSAvXFwvL2c7XG5sZXQgUkVHRVhQX09QRU5fUEFSRU5UID0gL1xcKC9nO1xubGV0IFJFR0VYUF9DTE9TRV9QQVJFTlQgPSAvXFwpL2c7XG5sZXQgUkVHRVhQX1NFTUlDT0xPTiA9IC87L2c7XG5cbmZ1bmN0aW9uIGVuY29kZUR5bmFtaWNTZWdtZW50KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoaXNCbGFuayh2YWx1ZSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhbHVlID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsKHZhbHVlLCBSRUdFWFBfUEVSQ0VOVCwgJyUyNScpO1xuICB2YWx1ZSA9IFN0cmluZ1dyYXBwZXIucmVwbGFjZUFsbCh2YWx1ZSwgUkVHRVhQX1NMQVNILCAnJTJGJyk7XG4gIHZhbHVlID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsKHZhbHVlLCBSRUdFWFBfT1BFTl9QQVJFTlQsICclMjgnKTtcbiAgdmFsdWUgPSBTdHJpbmdXcmFwcGVyLnJlcGxhY2VBbGwodmFsdWUsIFJFR0VYUF9DTE9TRV9QQVJFTlQsICclMjknKTtcbiAgdmFsdWUgPSBTdHJpbmdXcmFwcGVyLnJlcGxhY2VBbGwodmFsdWUsIFJFR0VYUF9TRU1JQ09MT04sICclM0InKTtcblxuICByZXR1cm4gdmFsdWU7XG59XG5cbmxldCBSRUdFWFBfRU5DX1NFTUlDT0xPTiA9IC8lM0IvaWc7XG5sZXQgUkVHRVhQX0VOQ19DTE9TRV9QQVJFTlQgPSAvJTI5L2lnO1xubGV0IFJFR0VYUF9FTkNfT1BFTl9QQVJFTlQgPSAvJTI4L2lnO1xubGV0IFJFR0VYUF9FTkNfU0xBU0ggPSAvJTJGL2lnO1xubGV0IFJFR0VYUF9FTkNfUEVSQ0VOVCA9IC8lMjUvaWc7XG5cbmZ1bmN0aW9uIGRlY29kZUR5bmFtaWNTZWdtZW50KHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoaXNCbGFuayh2YWx1ZSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhbHVlID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsKHZhbHVlLCBSRUdFWFBfRU5DX1NFTUlDT0xPTiwgJzsnKTtcbiAgdmFsdWUgPSBTdHJpbmdXcmFwcGVyLnJlcGxhY2VBbGwodmFsdWUsIFJFR0VYUF9FTkNfQ0xPU0VfUEFSRU5ULCAnKScpO1xuICB2YWx1ZSA9IFN0cmluZ1dyYXBwZXIucmVwbGFjZUFsbCh2YWx1ZSwgUkVHRVhQX0VOQ19PUEVOX1BBUkVOVCwgJygnKTtcbiAgdmFsdWUgPSBTdHJpbmdXcmFwcGVyLnJlcGxhY2VBbGwodmFsdWUsIFJFR0VYUF9FTkNfU0xBU0gsICcvJyk7XG4gIHZhbHVlID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsKHZhbHVlLCBSRUdFWFBfRU5DX1BFUkNFTlQsICclJyk7XG5cbiAgcmV0dXJuIHZhbHVlO1xufVxuIl19